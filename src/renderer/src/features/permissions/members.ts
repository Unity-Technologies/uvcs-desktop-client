import { EVERYONE, isBitsEmpty, OWNER, type AclLevel, type MemberRef, type ObjectPermissions } from '@shared/domain/permissions';
import { naturalCompare } from '../../lib/naturalCompare';
import { levelsAbove, readOwnBits } from './aclResolution';
import { draftBits, sameBits, type PermissionsDraft } from './permissionsDraft';

/** What a member is: `ALL USERS`, `OWNER`, a group or a user. */
export type MemberRole = 'everyone' | 'owner' | 'group' | 'user';

export function memberRole(name: string, groups: ReadonlySet<string>): MemberRole {
  if (name === EVERYONE) return 'everyone';
  if (name === OWNER) return 'owner';
  return groups.has(name) ? 'group' : 'user';
}

/** A member as `cm acl` takes it, its kind told by the server's groups. */
export function memberRef(name: string, groups: ReadonlySet<string>): MemberRef {
  const role = memberRole(name, groups);
  return { name, kind: role === 'group' || role === 'everyone' ? 'group' : 'user' };
}

/** How the dialog names a member: the special entries in plain words, users and groups as the server names them. */
export function memberLabel(name: string): string {
  if (name === EVERYONE) return 'All users';
  if (name === OWNER) return 'Owner';
  return name;
}

export interface MemberRow {
  member: MemberRef;
  role: MemberRole;
  label: string;
  /** Its own entry here says something, with the draft's edits. */
  setHere: boolean;
  /** The lists above with an entry for it, closest first, by creator spec. */
  inheritedFrom: string[];
  /** Added in this dialog. */
  added: boolean;
  /** The draft changes its entry. */
  changed: boolean;
}

const ROLE_ORDER: MemberRole[] = ['owner', 'everyone', 'group', 'user'];

/**
 * Everyone with an entry in the object's list or a list above, and those added here: Owner and All users first, then
 * groups, then users, each by name. A removed member stays while a list above still names it.
 */
export function memberRows(permissions: ObjectPermissions, draft: PermissionsDraft, groups: ReadonlySet<string>): MemberRow[] {
  const above = levelsAbove(permissions);
  const inheritedFrom = new Map<string, string[]>();
  for (const level of above) collectMembers(level, inheritedFrom);
  const own = permissions.ownAcl ? permissions.acl.entries.map((entry) => entry.member) : [];
  const names = new Set([...own, ...inheritedFrom.keys(), ...draft.added]);

  return [...names]
    .filter((name) => !draft.removed.has(name) || inheritedFrom.has(name))
    .map((name) => ({
      member: memberRef(name, groups),
      role: memberRole(name, groups),
      label: memberLabel(name),
      setHere: !isBitsEmpty(draftBits(permissions, draft, name)),
      inheritedFrom: inheritedFrom.get(name) ?? [],
      added: draft.added.has(name),
      changed: !sameBits(readOwnBits(permissions, name), draftBits(permissions, draft, name)),
    }))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || naturalCompare(a.label, b.label));
}

function collectMembers(level: AclLevel, found: Map<string, string[]>): void {
  for (const entry of level.entries) found.set(entry.member, [...(found.get(entry.member) ?? []), level.creator]);
  for (const parent of level.inherited) collectMembers(parent, found);
}

/**
 * Why a member's own entry can't be removed, if it can't: it has none here (it's set above), or it's the last entry
 * of the server's list, which must keep one.
 */
export function cannotRemoveReason(row: MemberRow, permissions: ObjectPermissions, isServer: boolean, rows: readonly MemberRow[]): string | undefined {
  if (!row.setHere && !row.added) return 'Set above: change it where it is set, or set it here instead';
  if (isServer && rows.filter((candidate) => candidate.setHere).length <= 1 && permissions.ownAcl) return 'The server keeps at least one user or group';
  return undefined;
}
