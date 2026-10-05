import {
  EVERYONE,
  isBitsEmpty,
  NO_BITS,
  OWNER,
  PERMISSION_NAMES,
  permissionSpec,
  type AclBits,
  type MemberRef,
  type PermissionChanges,
  type PermissionName,
  type PermissionTarget,
} from '@shared/domain/permissions';

/**
 * How `cm acl` and `cm setowner` name a member: `--user=` or `--group=`, `ALL USERS` as the group `all` and `OWNER`
 * as the user `OWNER` (`SEIDConsts` in `cm`).
 */
export function memberOption(member: MemberRef): string {
  if (member.name === EVERYONE) return '--group=all';
  if (member.name === OWNER) return '--user=OWNER';
  return `--${member.kind}=${member.name}`;
}

const SET_OPTIONS: [keyof AclBits, string][] = [
  ['allowed', '-allowed'],
  ['denied', '-denied'],
  ['overrideAllowed', '-overrideallowed'],
  ['overrideDenied', '-overridedenied'],
];

interface AclArgsOptions {
  /** Arguments before the spec (`--branches=`). */
  extra?: string[];
  /**
   * Lists every permission `desired` holds, even those `base` holds too (adding one twice changes nothing): the
   * command that gives an object its own list must run even when the entry it copies already says it all.
   */
  restate?: boolean;
}

/**
 * `cm acl` for one entry, or null when it already says that. `cm acl` changes the entry from what it says now: each
 * option lists the permissions to add (`+ci`) and to take away (`-rm`), so only what differs from `base` is written,
 * and an entry with nothing left is removed by the server.
 */
export function aclArgs(spec: string, member: MemberRef, base: AclBits, desired: AclBits, { extra = [], restate = false }: AclArgsOptions = {}): string[] | null {
  const options = SET_OPTIONS.flatMap(([set, option]) => {
    const changes = [...signed('+', desired[set], restate ? [] : base[set]), ...signed('-', base[set], desired[set])];
    return changes.length > 0 ? [`${option}=${changes.join(',')}`] : [];
  });
  return options.length > 0 ? ['acl', memberOption(member), ...options, ...extra, spec] : null;
}

/** `sign` and each permission of `from` that `other` doesn't hold, in `cm`'s order. */
function signed(sign: '+' | '-', from: readonly PermissionName[], other: readonly PermissionName[]): string[] {
  return PERMISSION_NAMES.filter((name) => from.includes(name) && !other.includes(name)).map((name) => `${sign}${name}`);
}

/**
 * The `cm acl` commands that set every changed entry, in order. What `cm` changes an entry from is the first list it
 * shows: the object's own, or, for an object sharing its parent's, the parent's entry for the same member, which the
 * first command copies into the object's new list (so it restates every permission, to run even when the copy says it
 * all). From then on the object has its own list, where the other members have no entry yet. A new group of branches
 * of a path is created by its first command (`--branches=`).
 */
export function aclCommands(target: PermissionTarget, changes: PermissionChanges): string[][] {
  const spec = permissionSpec(target);
  let createdOwnAcl = false;
  let branches = changes.branches && changes.branches.length > 0 ? [`--branches=${changes.branches.join(',')}`] : [];
  const commands: string[][] = [];
  for (const { member, desired } of changes.entries) {
    // An object without a list of its own has no entry to remove.
    if (!changes.seen.ownAcl && isBitsEmpty(desired)) continue;
    const createsOwnAcl = !changes.seen.ownAcl && !createdOwnAcl;
    const base = createdOwnAcl ? NO_BITS : entryBits(changes, member.name);
    const args = aclArgs(spec, member, base, desired, { extra: branches, restate: createsOwnAcl });
    if (!args) continue;
    commands.push(args);
    createdOwnAcl = !changes.seen.ownAcl;
    branches = [];
  }
  return commands;
}

/** What the first list `cm` showed says for `member`. */
function entryBits(changes: PermissionChanges, member: string): AclBits {
  return changes.seen.acl.entries.find((entry) => entry.member === member)?.bits ?? NO_BITS;
}

/** `cm setowner` giving the object to `owner`. */
export function setOwnerArgs(target: PermissionTarget, owner: MemberRef): string[] {
  return ['setowner', memberOption(owner), permissionSpec(target)];
}

/** `cm acl --delete`: the path's own permissions go (the secured path is removed). */
export function removePathArgs(target: PermissionTarget): string[] {
  return ['acl', '--delete', permissionSpec(target)];
}

/** `cm acl --branches=+a,-b`: branches added to and removed from a path's group, by their full names. */
export function pathBranchesArgs(target: PermissionTarget, add: readonly string[], remove: readonly string[]): string[] {
  return ['acl', `--branches=${[...add.map((name) => `+${name}`), ...remove.map((name) => `-${name}`)].join(',')}`, permissionSpec(target)];
}
