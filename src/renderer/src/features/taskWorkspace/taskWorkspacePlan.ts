import type { NewFolderCheck } from '@shared/domain/workspace';
import type { TaskWorkspacePlan } from './setUpTaskWorkspace';

/** Whether the task works on a new child of /main, or on a branch that exists. */
export type BranchMode = 'new' | 'existing';

interface TaskWorkspaceChoices {
  /** The repository of the workspace the dialog was opened from; undefined while it's read. */
  repository: string | undefined;
  mode: BranchMode;
  /** The full branch name: the new one typed, or the existing one picked. */
  branch: string | undefined;
  /** Why the name typed can't be a branch (`validateBranchName`). */
  branchError: string | undefined;
  folder: string;
  workspaceName: string;
  folderCheck: NewFolderCheck | undefined;
  /** Whether the new branch typed already exists; undefined until the server said. */
  typedExists: boolean | undefined;
  /** The workspace is being created: the choices stand as they were when it started. */
  running: boolean;
}

/**
 * What "Create workspace" would do, or null while it can't yet: a valid branch, a folder that is free, and, for a new
 * branch, knowing whether the name is taken. A new branch whose name is taken is simply worked on.
 */
export function taskWorkspacePlan(choices: TaskWorkspaceChoices): TaskWorkspacePlan | null {
  const { repository, mode, branch, branchError, folder, workspaceName, folderCheck, typedExists, running } = choices;
  if (!repository || !branch || branchError || !folder || !workspaceName || folderCheck !== 'available') return null;
  if (mode === 'new' && !running && typedExists === undefined) return null;
  return { repository, branch, newBranch: mode === 'new' && !typedExists, workspaceName, folder };
}
