import type { CmClient } from '../cm/CmClient';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { switchArgs } from '../cm/updateArgs';
import type { OperationContext } from '../operations/OperationTracker';

/**
 * `cm switch` as a process that reports its progress. `context.signal` stops it: a flow passes a signal that never
 * aborts once stopping would leave its changes halfway.
 */
export function runSwitch(cm: CmClient, workspacePath: string, targetSpec: string, context: OperationContext): Promise<string> {
  return cm.execute(switchArgs(targetSpec), { cwd: workspacePath, signal: context.signal, onOutputLine: context.progressOf(readUpdateProgress) });
}
