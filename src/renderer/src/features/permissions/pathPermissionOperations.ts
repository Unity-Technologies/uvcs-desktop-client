import type { PermissionTarget } from '@shared/domain/permissions';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';

/** The branches a group of branches names, as typed: full names apart by commas (`/main, /main/release`). */
export function parseBranchList(text: string): string[] {
  return [...new Set(text.split(',').map((name) => name.trim()).filter(Boolean))];
}

function refresh(target: PermissionTarget): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.permissionsOn(target.server) });
}

/** Asks, then removes the path's own permissions: on its branches it follows the repository again. */
export async function removePathPermissions(target: PermissionTarget): Promise<boolean> {
  const confirmed = await confirm({
    title: `Remove the permissions of ${target.name}?`,
    message: `${target.tag ? `On the branches of ${target.tag}, the` : 'The'} path follows the repository's permissions again.`,
    confirmLabel: 'Remove permissions',
    danger: true,
  });
  if (!confirmed) return false;
  try {
    await api.permissions.removePath(target);
    toast.success(`Removed the permissions of ${target.name}`);
    return true;
  } catch (error) {
    toast.error("Couldn't remove the path's permissions", error);
    return false;
  } finally {
    await refresh(target);
  }
}

/** Adds and removes branches of the path's group of branches. */
export async function editPathBranches(target: PermissionTarget, add: string[], remove: string[]): Promise<boolean> {
  try {
    await api.permissions.editPathBranches(target, { add, remove });
    toast.success(`Branches of ${target.tag} changed`);
    return true;
  } catch (error) {
    toast.error("Couldn't change the group's branches", error);
    return false;
  } finally {
    await refresh(target);
  }
}
