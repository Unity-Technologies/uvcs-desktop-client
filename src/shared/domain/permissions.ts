/**
 * Permissions (access control lists) of server objects, as `cm showacl`, `cm acl` and `cm setowner` know them
 * (docs/features/permissions.md).
 */

/**
 * Every permission, by the name `cm acl` takes and `cm showacl` prints (`cm showpermissions`), in `cm`'s order.
 * `purge` is left out: `cm` only knows it where purges are enabled, and the official client hides it the same way.
 */
export const PERMISSION_NAMES = [
  'configlocks',
  'chgperm',
  'chgowner',
  'view',
  'read',
  'rename',
  'changecomment',
  'mkrepository',
  'rmrepository',
  'rmchangeset',
  'rmlabel',
  'rmtrigger',
  'rmattr',
  'mkchildbranch',
  'mktop-levelbranch',
  'mklabel',
  'mkattr',
  'mktrigger',
  'mergefrom',
  'applylabel',
  'applyattr',
  'replicateread',
  'replicatewrite',
  'add',
  'change',
  'move',
  'rm',
  'ci',
  'advancedquery',
] as const;

export type PermissionName = (typeof PERMISSION_NAMES)[number];

/**
 * What `cm showacl` prints as `all`: every permission but `advancedquery` (and `purge`), as `ALL_PERMISSIONS` holds
 * them on the server.
 */
export const ALL_KEYWORD_PERMISSIONS: readonly PermissionName[] = PERMISSION_NAMES.filter((name) => name !== 'advancedquery');

/** The objects that have permissions of their own: what `cm acl` sets them on. */
export type PermissionTargetKind = 'server' | 'repository' | 'branch' | 'label' | 'attribute' | 'path';

/** The object whose permissions are read or set. */
export interface PermissionTarget {
  kind: PermissionTargetKind;
  /** The server, as `cm` takes it: `local`, `acme@cloud`, `ci.corp:8087`. */
  server: string;
  /** `name@server`, for every kind but `server`; the repository itself for `repository`. */
  repository?: string;
  /**
   * The object's own name: the server for `server`, the repository's name for `repository`, the branch's full name,
   * the label's or attribute's name, or for `path` the server path the permissions apply to (`/src`, `/` for all).
   */
  name: string;
  /** A path's group of branches, by its tag (`path:/src#release`); none for the path on every branch. */
  tag?: string;
  /** The owner, where the list the object came from already read it: saves a `cm showowner`. */
  knownOwner?: string;
}

/**
 * Where each permission applies, as the server decides (`ClientPermissions` in the official client): a branch can't
 * create repositories. A path takes the item permissions its check-ins are checked against, plus who may change its
 * permissions; the official client hides `view` there.
 */
export const APPLICABLE_PERMISSIONS: Record<PermissionTargetKind, readonly PermissionName[]> = {
  server: PERMISSION_NAMES,
  repository: PERMISSION_NAMES.filter((name) => name !== 'mkrepository'),
  branch: [
    'chgperm',
    'chgowner',
    'view',
    'read',
    'rename',
    'changecomment',
    'rmchangeset',
    'rmattr',
    'mkchildbranch',
    'mergefrom',
    'applylabel',
    'applyattr',
    'replicateread',
    'replicatewrite',
    'add',
    'change',
    'move',
    'rm',
    'ci',
  ],
  label: ['chgperm', 'chgowner', 'view', 'read', 'rename', 'changecomment', 'rmlabel', 'rmattr', 'mkchildbranch', 'mergefrom', 'applylabel', 'applyattr'],
  attribute: ['chgperm', 'chgowner', 'view', 'read', 'rename', 'changecomment', 'rmattr', 'applyattr'],
  path: ['chgperm', 'chgowner', 'read', 'add', 'change', 'move', 'rm', 'ci'],
};

/**
 * What one entry of an access control list says about the permissions it names: allowed, denied, and "override",
 * which drops what the entries above (the levels the object inherits from) allow or deny for the same user or group.
 * A deny always wins over an allow.
 */
export interface AclBits {
  allowed: PermissionName[];
  denied: PermissionName[];
  /** The inherited allows of these permissions don't count here. */
  overrideAllowed: PermissionName[];
  /** The inherited denies of these permissions don't count here. */
  overrideDenied: PermissionName[];
}

export const NO_BITS: AclBits = { allowed: [], denied: [], overrideAllowed: [], overrideDenied: [] };

export interface AclEntry {
  /** The user or group as `cm` prints it, with its two special entries: `ALL USERS` and `OWNER`. */
  member: string;
  bits: AclBits;
}

/** One access control list of the chain `cm showacl --extended` prints: its entries, and the lists it inherits from. */
export interface AclLevel {
  /** The object the list belongs to, as `cm` prints its spec: `br:/main@rep:game@repserver:local`, `repserver:local`. */
  creator: string;
  entries: AclEntry[];
  inherited: AclLevel[];
}

/** `ALL USERS`: every user, whatever their groups (`--group=all` to `cm acl`). */
export const EVERYONE = 'ALL USERS';
/** `OWNER`: whoever owns the object (`--user=OWNER` to `cm acl`). */
export const OWNER = 'OWNER';

export type MemberKind = 'user' | 'group';

/** A user or group, which `cm acl` and `cm setowner` take as `--user=` or `--group=`. */
export interface MemberRef {
  name: string;
  kind: MemberKind;
}

export interface ObjectPermissions {
  /** The chain as `cm showacl --extended` prints it, the closest list first. */
  acl: AclLevel;
  /**
   * Whether `acl` is the object's own list. An object starts sharing its parent's (a branch, its repository's), which
   * `cm` then shows as the first; setting a permission gives it one of its own. For a path, whether it is secured.
   */
  ownAcl: boolean;
  /** Who owns it; null where `cm` couldn't tell. */
  owner: MemberRef | null;
}

/** The change to one entry: what it should say from now on. */
export interface EntryChange {
  member: MemberRef;
  /** All empty removes the entry. */
  desired: AclBits;
}

export interface PermissionChanges {
  /** The permissions the changes were made on, as read: `cm acl` changes an entry from what the list says now. */
  seen: Pick<ObjectPermissions, 'acl' | 'ownAcl'>;
  entries: EntryChange[];
  owner?: MemberRef;
  /** The branches of a new path group (`target.tag`): `cm acl` creates it with its first entry. */
  branches?: string[];
}

/** The spec `cm showacl`, `cm acl`, `cm showowner` and `cm setowner` take for the object. */
export function permissionSpec(target: PermissionTarget): string {
  switch (target.kind) {
    case 'server':
      return `repserver:${target.server}`;
    case 'repository':
      return `rep:${target.repository ?? `${target.name}@${target.server}`}`;
    case 'branch':
      return `br:${target.name}@${target.repository}`;
    case 'label':
      return `lb:${target.name}@${target.repository}`;
    case 'attribute':
      return `att:${target.name}@${target.repository}`;
    case 'path':
      return `path:${target.name}${target.tag ? `#${target.tag}` : ''}@${target.repository}`;
  }
}

/** The server of a repository spec: `game@acme@cloud` → `acme@cloud` (repository names hold no `@`). */
export function serverOfRepository(repository: string): string {
  const at = repository.indexOf('@');
  return at < 0 ? '' : repository.slice(at + 1);
}

export function isBitsEmpty(bits: AclBits): boolean {
  return bits.allowed.length === 0 && bits.denied.length === 0 && bits.overrideAllowed.length === 0 && bits.overrideDenied.length === 0;
}
