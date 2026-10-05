import type { MemberKind, ObjectPermissions, PermissionChanges, PermissionTarget } from '../domain/permissions';

/** Reading and setting who may do what on a server, a repository, a branch, a label, an attribute or a path. */
export interface PermissionsApi {
  /** The object's access control list, the lists it inherits from, and its owner. */
  read(target: PermissionTarget): Promise<ObjectPermissions>;
  /** The server's users or groups by name (`cm listusers`), only those containing `filter` when given. */
  members(server: string, kind: MemberKind, filter?: string): Promise<string[]>;
  /** Sets each changed entry, then the new owner: one `cm acl` per entry, one `cm setowner`. */
  apply(target: PermissionTarget, changes: PermissionChanges): Promise<void>;
  /** The path's own permissions go: on its branches it follows the repository again (the secured path is removed). */
  removePath(target: PermissionTarget): Promise<void>;
  /** Adds and removes branches of a path's group of branches (`target.tag`), leaving the others. */
  editPathBranches(target: PermissionTarget, branches: { add: string[]; remove: string[] }): Promise<void>;
}
