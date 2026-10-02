import { NO_BITS, type AclBits, type AclLevel, type ObjectPermissions, type PermissionName } from '@shared/domain/permissions';

/** What a member's own entry says about one permission: nothing (it follows what's above), allow, or deny. */
export type OwnState = 'inherit' | 'allow' | 'deny';

export type Effective = 'allowed' | 'denied' | 'notAllowed';

/** Where an allow or deny comes from: `here` (the object's own entry) or the creator spec of a list above. */
export type Source = 'here' | string;

export interface PermissionResolution {
  own: OwnState;
  /** The own entry drops what the lists above allow (`overrideAllowed`). */
  ignoresAllowsAbove: boolean;
  /** The own entry drops what the lists above deny (`overrideDenied`). */
  ignoresDeniesAbove: boolean;
  /** What the lists above say for this member, before the own entry's overrides drop any of it: the closest that says it. */
  above: { allowedBy?: string; deniedBy?: string };
  /** The result for this member: a deny wins over an allow. */
  effective: Effective;
  /** Where the effective allow or deny comes from; none for "not allowed". */
  source?: Source;
}

/** Permissions a chain allows and denies for a member, each with the closest list that says it. */
interface ChainVerdict {
  allowed: Map<PermissionName, string>;
  denied: Map<PermissionName, string>;
}

interface Overrides {
  allowed: Set<PermissionName>;
  denied: Set<PermissionName>;
}

/**
 * What a chain of lists says for `member`, as the server works it out (`PermissionCalculator.GetNotOverridden`): each
 * list's entry counts but for what a closer list overrode, then adds its own overrides for the lists above it; lists
 * an object inherits from side by side allow only what all of them allow, and deny what any denies. `overrides` is
 * shared along the walk, as the server's is.
 */
function chainVerdict(level: AclLevel, member: string, overrides: Overrides): ChainVerdict {
  const verdict: ChainVerdict = { allowed: new Map(), denied: new Map() };
  const entry = level.entries.find((candidate) => candidate.member === member);
  if (entry) {
    for (const name of entry.bits.allowed) if (!overrides.allowed.has(name)) verdict.allowed.set(name, level.creator);
    for (const name of entry.bits.denied) if (!overrides.denied.has(name)) verdict.denied.set(name, level.creator);
    entry.bits.overrideAllowed.forEach((name) => overrides.allowed.add(name));
    entry.bits.overrideDenied.forEach((name) => overrides.denied.add(name));
  }
  const inherited = sideBySide(level.inherited, member, overrides);
  for (const [name, source] of inherited.allowed) if (!verdict.allowed.has(name)) verdict.allowed.set(name, source);
  for (const [name, source] of inherited.denied) if (!verdict.denied.has(name)) verdict.denied.set(name, source);
  return verdict;
}

function sideBySide(levels: readonly AclLevel[], member: string, overrides: Overrides): ChainVerdict {
  const [first, ...others] = levels;
  if (!first) return { allowed: new Map(), denied: new Map() };
  const combined = chainVerdict(first, member, overrides);
  for (const other of others) {
    const verdict = chainVerdict(other, member, overrides);
    for (const name of [...combined.allowed.keys()]) if (!verdict.allowed.has(name)) combined.allowed.delete(name);
    for (const [name, source] of verdict.denied) if (!combined.denied.has(name)) combined.denied.set(name, source);
  }
  return combined;
}

/** The lists above the object: those it inherits from, or, sharing its parent's list, that list and its own. */
export function levelsAbove(permissions: Pick<ObjectPermissions, 'acl' | 'ownAcl'>): AclLevel[] {
  return permissions.ownAcl ? permissions.acl.inherited : [permissions.acl];
}

/** What the object's own list says for `member` as read: nothing when it shares its parent's. */
export function readOwnBits(permissions: Pick<ObjectPermissions, 'acl' | 'ownAcl'>, member: string): AclBits {
  if (!permissions.ownAcl) return NO_BITS;
  return permissions.acl.entries.find((entry) => entry.member === member)?.bits ?? NO_BITS;
}

export function ownStateOf(bits: AclBits, permission: PermissionName): OwnState {
  if (bits.denied.includes(permission)) return 'deny';
  return bits.allowed.includes(permission) ? 'allow' : 'inherit';
}

/**
 * How each permission resolves for `member` when its own entry says `own`: what it says, what the lists above say,
 * and the result. Only this member's entries count: a user's groups and `ALL USERS` add theirs on the server.
 */
export function resolvePermissions(
  permissions: Pick<ObjectPermissions, 'acl' | 'ownAcl'>,
  member: string,
  own: AclBits,
  names: readonly PermissionName[],
): Map<PermissionName, PermissionResolution> {
  const above = levelsAbove(permissions);
  const raw = sideBySide(above, member, { allowed: new Set(), denied: new Set() });
  const overridden = sideBySide(above, member, { allowed: new Set(own.overrideAllowed), denied: new Set(own.overrideDenied) });

  return new Map(
    names.map((name) => {
      const state = ownStateOf(own, name);
      const deniedBy = own.denied.includes(name) ? 'here' : overridden.denied.get(name);
      const allowedBy = own.allowed.includes(name) ? 'here' : overridden.allowed.get(name);
      const effective: Effective = deniedBy ? 'denied' : allowedBy ? 'allowed' : 'notAllowed';
      return [
        name,
        {
          own: state,
          ignoresAllowsAbove: own.overrideAllowed.includes(name),
          ignoresDeniesAbove: own.overrideDenied.includes(name),
          above: { allowedBy: raw.allowed.get(name), deniedBy: raw.denied.get(name) },
          effective,
          source: deniedBy ?? allowedBy,
        },
      ];
    }),
  );
}
