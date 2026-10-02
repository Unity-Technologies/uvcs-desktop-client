import {
  NO_BITS,
  PERMISSION_NAMES,
  type AclBits,
  type EntryChange,
  type MemberRef,
  type ObjectPermissions,
  type PermissionChanges,
  type PermissionName,
} from '@shared/domain/permissions';
import { readOwnBits, type OwnState } from './aclResolution';

/**
 * The edits made in the permissions dialog, not yet saved: what each touched member's own entry should say, the
 * members added and removed, and the new owner. Every edit returns a new draft; nothing reaches the server until the
 * changes (`draftChanges`) are saved.
 */
export interface PermissionsDraft {
  /** The own entry each touched member should have, by member name. */
  entries: ReadonlyMap<string, { member: MemberRef; bits: AclBits }>;
  /** Members added here, listed even while their entry says nothing yet. */
  added: ReadonlySet<string>;
  /** Members whose own entry goes. */
  removed: ReadonlySet<string>;
  owner?: MemberRef;
}

export const EMPTY_DRAFT: PermissionsDraft = { entries: new Map(), added: new Set(), removed: new Set() };

type Seen = Pick<ObjectPermissions, 'acl' | 'ownAcl'>;

/** What `member`'s own entry says with the draft's edits. */
export function draftBits(seen: Seen, draft: PermissionsDraft, member: string): AclBits {
  return draft.entries.get(member)?.bits ?? readOwnBits(seen, member);
}

function withBits(draft: PermissionsDraft, member: MemberRef, bits: AclBits): PermissionsDraft {
  return { ...draft, entries: new Map(draft.entries).set(member.name, { member, bits }) };
}

/** `names` with `permission` in or out, in `cm`'s order. */
function toggled(names: readonly PermissionName[], permission: PermissionName, present: boolean): PermissionName[] {
  return PERMISSION_NAMES.filter((name) => (name === permission ? present : names.includes(name)));
}

/**
 * Sets what `member`'s own entry says about `permissions`. Back to "inherit" drops its overrides too: the permission
 * follows the lists above again, all of what they say.
 */
export function setOwnState(seen: Seen, draft: PermissionsDraft, member: MemberRef, permissions: readonly PermissionName[], state: OwnState): PermissionsDraft {
  let bits = draftBits(seen, draft, member.name);
  for (const permission of permissions) {
    bits = {
      allowed: toggled(bits.allowed, permission, state === 'allow'),
      denied: toggled(bits.denied, permission, state === 'deny'),
      overrideAllowed: state === 'inherit' ? toggled(bits.overrideAllowed, permission, false) : bits.overrideAllowed,
      overrideDenied: state === 'inherit' ? toggled(bits.overrideDenied, permission, false) : bits.overrideDenied,
    };
  }
  return withBits(draft, member, bits);
}

export type OverrideKind = 'overrideAllowed' | 'overrideDenied';

/** Whether `member`'s own entry drops what the lists above allow (`overrideAllowed`) or deny (`overrideDenied`). */
export function setOverride(seen: Seen, draft: PermissionsDraft, member: MemberRef, permission: PermissionName, kind: OverrideKind, on: boolean): PermissionsDraft {
  const bits = draftBits(seen, draft, member.name);
  return withBits(draft, member, { ...bits, [kind]: toggled(bits[kind], permission, on) });
}

/** Lists a member here, its entry saying nothing yet; one that was being removed comes back as it was. */
export function addMember(draft: PermissionsDraft, member: MemberRef): PermissionsDraft {
  if (draft.removed.has(member.name)) return undoMember(draft, member.name);
  return { ...draft, added: new Set(draft.added).add(member.name) };
}

/** Removes `member`'s own entry; one added here simply goes. */
export function removeMember(draft: PermissionsDraft, member: MemberRef): PermissionsDraft {
  const undone = undoMember(draft, member.name);
  if (draft.added.has(member.name)) return undone;
  return { ...withBits(undone, member, NO_BITS), removed: new Set(undone.removed).add(member.name) };
}

/** Drops every edit of `member`: its entry says what it said. */
export function undoMember(draft: PermissionsDraft, member: string): PermissionsDraft {
  const entries = new Map(draft.entries);
  entries.delete(member);
  const added = new Set(draft.added);
  added.delete(member);
  const removed = new Set(draft.removed);
  removed.delete(member);
  return { ...draft, entries, added, removed };
}

export function setOwner(draft: PermissionsDraft, owner: MemberRef | undefined): PermissionsDraft {
  return { ...draft, owner };
}

export function sameBits(a: AclBits, b: AclBits): boolean {
  const same = (x: readonly PermissionName[], y: readonly PermissionName[]) => x.length === y.length && x.every((name) => y.includes(name));
  return same(a.allowed, b.allowed) && same(a.denied, b.denied) && same(a.overrideAllowed, b.overrideAllowed) && same(a.overrideDenied, b.overrideDenied);
}

/** One entry the draft changes: what it says now and what it will say. */
export interface DraftEntryChange {
  member: MemberRef;
  before: AclBits;
  after: AclBits;
  removed: boolean;
}

export interface DraftChanges {
  entries: DraftEntryChange[];
  owner?: { before: MemberRef | null; after: MemberRef };
}

/**
 * What saving the draft changes, against the permissions as read: entries that say something else from now on (an
 * edit that went back to what was read changes nothing), and the owner if it's another.
 */
export function draftChanges(permissions: ObjectPermissions, draft: PermissionsDraft): DraftChanges {
  const entries = [...draft.entries.values()]
    .map(({ member, bits }) => ({ member, before: readOwnBits(permissions, member.name), after: bits, removed: draft.removed.has(member.name) }))
    .filter(({ before, after }) => !sameBits(before, after));
  const owner = draft.owner && draft.owner.name !== permissions.owner?.name ? { before: permissions.owner, after: draft.owner } : undefined;
  return { entries, ...(owner && { owner }) };
}

export function changeCount(changes: DraftChanges): number {
  return changes.entries.length + (changes.owner ? 1 : 0);
}

/** The request that saves the changes. */
export function changeRequest(permissions: ObjectPermissions, changes: DraftChanges, branches?: string[]): PermissionChanges {
  const entries: EntryChange[] = changes.entries.map(({ member, after }) => ({ member, desired: after }));
  return {
    seen: { acl: permissions.acl, ownAcl: permissions.ownAcl },
    entries,
    ...(changes.owner && { owner: changes.owner.after }),
    ...(branches && { branches }),
  };
}

/** Whether saving takes something away that is hard to get back: an entry removed, or someone's right to change permissions. */
export function needsConfirmation(changes: DraftChanges): boolean {
  return changes.entries.some(({ before, after, removed }) => removed || (!before.denied.includes('chgperm') && after.denied.includes('chgperm'))) || changes.owner !== undefined;
}
