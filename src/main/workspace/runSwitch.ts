import type { WorkspaceKind } from '@shared/domain/workspace';
import type { CmClient } from '../cm/CmClient';
import { switchCommand } from '../cm/updateArgs';
import type { OperationContext } from '../operations/OperationTracker';

/**
 * `cm switch` (`cm partial switch` in a partial workspace) as a process that reports its progress. `context.signal`
 * stops it: a flow passes a signal that never aborts once stopping would leave its changes halfway.
 */
export function runSwitch(cm: CmClient, workspacePath: string, targetSpec: string, kind: WorkspaceKind, context: OperationContext): Promise<string> {
  const { args, readProgress } = switchCommand(targetSpec, kind);
  return cm.execute(args, { cwd: workspacePath, signal: context.signal, onOutputLine: context.progressOf(readProgress) });
}
