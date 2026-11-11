import type { WorkspaceKind } from '@shared/domain/workspace';
import { readPartialUpdateProgress } from './progress/partialUpdateProgress';
import type { ProgressReader } from './progress/progressReader';
import { readUpdateProgress } from './progress/updateProgress';

/** A `cm` command that rewrites the workspace, and how its output reads as progress. */
export interface ProgressingCommand {
  args: string[];
  readProgress: ProgressReader;
}

/**
 * `--forcedetailedprogress` keeps the progress line (bytes and files, see `readUpdateProgress`) that `cm` prints only to
 * a terminal, and that `--machinereadable` would turn off in exchange for one line per item and no totals.
 * `cm partial update` and `cm partial switch` refuse it: they always print their own line (`readPartialUpdateProgress`).
 */
const PROGRESS = '--forcedetailedprogress';

/**
 * Updates the workspace: `cm partial update` in a partial workspace, which updates only what it loads. `--dontmerge`:
 * never launch an external merge tool. `cm update` stops on conflicts with local changes, resolved in the Incoming view;
 * `cm partial update` skips those files and updates the rest. `cm partial update` never asks, and refuses `--noinput`.
 */
export function updateCommand(kind: WorkspaceKind): ProgressingCommand {
  if (kind === 'partial') return { args: ['partial', 'update', '--dontmerge'], readProgress: readPartialUpdateProgress };
  return { args: ['update', PROGRESS, '--noinput', '--dontmerge'], readProgress: readUpdateProgress };
}

/** Switches the workspace to `targetSpec`: `cm partial switch` in a partial workspace, which only switches to branches. */
export function switchCommand(targetSpec: string, kind: WorkspaceKind): ProgressingCommand {
  if (kind === 'partial') return { args: ['partial', 'switch', targetSpec, '--noinput'], readProgress: readPartialUpdateProgress };
  return { args: ['switch', targetSpec, PROGRESS, '--noinput'], readProgress: readUpdateProgress };
}
