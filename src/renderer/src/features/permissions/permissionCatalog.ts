import type { PermissionName } from '@shared/domain/permissions';

export type PermissionGroupId = 'content' | 'branches' | 'labels' | 'attributes' | 'object' | 'security' | 'repositories' | 'replication';

/** The groups the permissions are listed under, in order: what people do most first. */
export const PERMISSION_GROUPS: { id: PermissionGroupId; label: string }[] = [
  { id: 'content', label: 'Files and check-ins' },
  { id: 'branches', label: 'Branches and merges' },
  { id: 'labels', label: 'Labels' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'object', label: 'Names and comments' },
  { id: 'security', label: 'Permissions and owner' },
  { id: 'repositories', label: 'Repositories and server' },
  { id: 'replication', label: 'Replication' },
];

export interface PermissionInfo {
  /** What it lets someone do, in plain words. */
  label: string;
  /** Its definition, for the tooltip. */
  description: string;
  group: PermissionGroupId;
}

/**
 * Every permission in plain words. The row shows `cm`'s name too (`ci`, `mkchildbranch`): it's the name the security
 * guide, the server's log and `cm acl` use, which administrators know them by.
 */
export const PERMISSION_INFO: Record<PermissionName, PermissionInfo> = {
  view: { label: 'See', description: 'See that it exists, in lists and searches.', group: 'content' },
  read: { label: 'Read', description: 'Read its contents and history: download files, diff, browse.', group: 'content' },
  ci: { label: 'Check in', description: 'Check in changes.', group: 'content' },
  add: { label: 'Add files', description: 'Add files and folders in a check-in.', group: 'content' },
  change: { label: 'Change files', description: 'Change files and folders in a check-in.', group: 'content' },
  move: { label: 'Move files', description: 'Move and rename files and folders in a check-in.', group: 'content' },
  rm: { label: 'Delete files', description: 'Delete files and folders in a check-in.', group: 'content' },
  mkchildbranch: { label: 'Create child branches', description: 'Create branches under a branch.', group: 'branches' },
  'mktop-levelbranch': { label: 'Create top-level branches', description: 'Create branches at the top, beside /main.', group: 'branches' },
  mergefrom: { label: 'Merge from', description: 'Merge its changes into another branch.', group: 'branches' },
  rmchangeset: { label: 'Delete changesets', description: 'Delete changesets from a branch.', group: 'branches' },
  mklabel: { label: 'Create labels', description: 'Create labels.', group: 'labels' },
  applylabel: { label: 'Apply labels', description: 'Label a changeset.', group: 'labels' },
  rmlabel: { label: 'Delete labels', description: 'Delete labels.', group: 'labels' },
  mkattr: { label: 'Create attributes', description: 'Create attributes.', group: 'attributes' },
  applyattr: { label: 'Set attribute values', description: 'Give branches, changesets and labels attribute values.', group: 'attributes' },
  rmattr: { label: 'Delete attributes', description: 'Delete attributes and their values.', group: 'attributes' },
  rename: { label: 'Rename', description: 'Rename it.', group: 'object' },
  changecomment: { label: 'Edit comments', description: 'Edit its comments.', group: 'object' },
  chgperm: { label: 'Change permissions', description: 'Change who may do what, as here.', group: 'security' },
  chgowner: { label: 'Change owner', description: 'Give it to another user or group.', group: 'security' },
  mkrepository: { label: 'Create repositories', description: 'Create repositories on the server.', group: 'repositories' },
  rmrepository: { label: 'Delete repositories', description: 'Delete repositories.', group: 'repositories' },
  configlocks: { label: 'Configure lock rules', description: 'Add the rules that decide which files lock.', group: 'repositories' },
  mktrigger: { label: 'Create triggers', description: 'Create server triggers.', group: 'repositories' },
  rmtrigger: { label: 'Delete triggers', description: 'Delete server triggers.', group: 'repositories' },
  advancedquery: { label: 'Run advanced queries', description: 'Run advanced queries on the server.', group: 'repositories' },
  replicateread: { label: 'Replicate from here', description: 'Pull or push its changes from this server to another.', group: 'replication' },
  replicatewrite: { label: 'Replicate here', description: 'Pull or push changes from another server into this one.', group: 'replication' },
};

export interface PermissionGroup {
  id: PermissionGroupId;
  label: string;
  permissions: PermissionName[];
}

/** `permissions` under their groups, in the groups' order, each group in the catalog's order; empty groups left out. */
export function groupPermissions(permissions: readonly PermissionName[]): PermissionGroup[] {
  const order = Object.keys(PERMISSION_INFO) as PermissionName[];
  return PERMISSION_GROUPS.map(({ id, label }) => ({
    id,
    label,
    permissions: order.filter((name) => PERMISSION_INFO[name].group === id && permissions.includes(name)),
  })).filter((group) => group.permissions.length > 0);
}
