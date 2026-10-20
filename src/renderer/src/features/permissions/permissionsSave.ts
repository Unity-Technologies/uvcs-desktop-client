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
  /** Why it is disabled; undefined while it can save, and while it saves (it shows it is busy). */
  disabledReason: string | undefined;
}

export function permissionsSaveButton({ changeCount, saving, createsGroup, groupBranchCount }: PermissionsSaveInput): PermissionsSaveButton {
  const label = changeCount > 1 ? `Save ${pluralize(changeCount, 'change')}` : 'Save';
  if (saving) return { enabled: false, label, disabledReason: undefined };
  if (changeCount === 0) return { enabled: false, label, disabledReason: 'Nothing changed yet' };
  if (createsGroup && groupBranchCount === 0) return { enabled: false, label, disabledReason: 'Name the branches of the new group first' };
  return { enabled: true, label, disabledReason: undefined };
}
