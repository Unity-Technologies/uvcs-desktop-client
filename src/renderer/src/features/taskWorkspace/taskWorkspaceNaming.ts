import { shortBranchName } from '@shared/domain/specs';
import { joinPath, lastSegment, parentDirectory } from '../../lib/paths';
import { suggestWorkspaceName } from '../../app/home/workspaceNaming';

/** New task branches hang from /main and start at its head. */
export const TASK_PARENT_BRANCH = '/main';

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** A branch name to start from, unique enough for tasks started minutes apart: `task-0925-1432`. */
export function suggestTaskBranchName(now: Date): string {
  return `task-${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}-${twoDigits(now.getHours())}${twoDigits(now.getMinutes())}`;
}

/**
 * Where the task's workspace goes: next to the current one, named after the repository and the branch,
 * e.g. `/wk/codice` on `codice` and `/main/task-12` → `/wk/codice-task-12`.
 */
export function defaultTaskFolder(currentWorkspacePath: string, repositoryName: string, branch: string): string {
  const repository = lastSegment(repositoryName);
  const leaf = shortBranchName(branch);
  return joinPath(parentDirectory(currentWorkspacePath), leaf ? `${repository}-${leaf}` : repository);
}

/** The workspace is named after its folder, made unique among the workspaces already on this computer. */
export function taskWorkspaceName(folder: string, takenNames: readonly string[]): string {
  return suggestWorkspaceName(lastSegment(folder), takenNames);
}
