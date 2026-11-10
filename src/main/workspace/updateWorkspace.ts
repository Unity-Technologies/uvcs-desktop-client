import type { WorkspaceKind } from '@shared/domain/workspace';
import type { CmClient } from '../cm/CmClient';
import { PARTIAL_UPDATE_ARGS } from '../cm/partialWorkspace';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { UPDATE_ARGS } from '../cm/updateArgs';
import type { OperationContext } from '../operations/OperationTracker';

/**
 * Updates the workspace as its kind needs: a partial workspace with `PARTIAL_UPDATE_ARGS`, since a plain update would
 * load everything and make it standard (its progress can't be shown: it prints no line per file); any other with
 * `UPDATE_ARGS`, showing its progress. Both stop when local changes collide with incoming ones (`--dontmerge`).
 */
export function updateWorkspace(
  cm: CmClient,
  workspacePath: string,
  kind: WorkspaceKind | undefined,
  { signal, progressOf }: Pick<OperationContext, 'signal' | 'progressOf'>,
): Promise<string> {
  if (kind === 'partial') return cm.execute([...PARTIAL_UPDATE_ARGS], { cwd: workspacePath, signal });
  return cm.execute(UPDATE_ARGS, { cwd: workspacePath, signal, onOutputLine: progressOf(readUpdateProgress) });
}
