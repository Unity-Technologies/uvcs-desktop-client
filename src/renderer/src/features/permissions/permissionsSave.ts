import { pluralize } from '../../lib/text';

interface PermissionsSaveInput {
  /** The draft's changes (`changeCount`). */
  changeCount: number;
  saving: boolean;
  /** The dialog creates a group of branches, which needs them named (`isNewGroup`). */
  createsGroup: boolean;
  /** How many branches the group's field names. */
  groupBranchCount: number;
}

/** The permissions dialog's Save button: whether it saves, its label, and why it can't when it can't. */
export interface PermissionsSaveButton {
  enabled: boolean;
  label: string;
  /** Why it is disabled; undefined while it can save. */
  disabledReason: string | undefined;
}

export function permissionsSaveButton({ changeCount, saving, createsGroup, groupBranchCount }: PermissionsSaveInput): PermissionsSaveButton {
  const enabled = changeCount > 0 && !saving && (!createsGroup || groupBranchCount > 0);
  return {
    enabled,
    label: changeCount > 1 ? `Save ${pluralize(changeCount, 'change')}` : 'Save',
    disabledReason: enabled ? undefined : changeCount > 0 ? 'Name the branches of the new group first' : 'Nothing changed yet',
  };
}
