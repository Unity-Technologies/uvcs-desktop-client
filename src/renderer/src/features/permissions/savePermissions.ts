import type { ObjectPermissions, PermissionTarget } from '@shared/domain/permissions';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { invalidateWorkspace, queryClient } from '../../app/queryClient';
import { isAffectedByPermissions } from '../../app/refresh/refreshScopes';
import { confirm } from '../../ui/dialog/confirm';
import { toast } from '../../ui/toast/toastStore';
import { changeCount, changeRequest, needsConfirmation, type DraftChanges } from './permissionsDraft';

export interface SaveRequest {
  target: PermissionTarget;
  /** The permissions the changes were made on. */
  permissions: ObjectPermissions;
  changes: DraftChanges;
  /** The branches of a path's new group of branches. */
  branches?: string[];
  /** The workspace the dialog was opened from, whose lists may show the owner. */
  workspacePath?: string;
}

const changesWord = (count: number) => (count === 1 ? '1 change' : `${count} changes`);

/**
 * Saves the dialog's changes, after asking where they take away what may be hard to get back. Resolves to whether
 * all were saved. Every object's permissions on the server are read again either way: the changes, and what objects
 * inherit from this one, show as they are now; after a failure, the changes that went through drop out of the draft.
 */
export async function savePermissions({ target, permissions, changes, branches, workspacePath }: SaveRequest): Promise<boolean> {
  const count = changeCount(changes);
  if (
    needsConfirmation(changes) &&
    !(await confirm({
      title: `Save ${changesWord(count)}?`,
      message: 'Removing an entry, giving the object to someone else or denying who may change permissions can leave you unable to change them back.',
      confirmLabel: 'Save',
      danger: true,
    }))
  ) {
    return false;
  }

  try {
    await api.permissions.apply(target, changeRequest(permissions, changes, branches));
    toast.success(count === 1 ? 'Permission change saved' : `${count} permission changes saved`);
    return true;
  } catch (error) {
    toast.error("Couldn't save every change", error);
    return false;
  } finally {
    await queryClient.invalidateQueries({ queryKey: queryKeys.permissionsOn(target.server) });
    if (changes.owner) {
      if (workspacePath) void invalidateWorkspace(workspacePath, isAffectedByPermissions(target.kind, true));
      if (target.kind === 'repository') void queryClient.invalidateQueries({ queryKey: queryKeys.repositories(target.server) });
    }
  }
}
