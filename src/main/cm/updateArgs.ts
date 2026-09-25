/**
 * `--forcedetailedprogress` keeps the progress line (bytes and files, see `readUpdateProgress`) that `cm` prints only to
 * a terminal, and that `--machinereadable` would turn off in exchange for one line per item and no totals.
 */
const PROGRESS = '--forcedetailedprogress';

/** `--dontmerge`: never launch an external merge tool. Conflicts with local changes are resolved in the Incoming view. */
export const UPDATE_ARGS = ['update', PROGRESS, '--noinput', '--dontmerge'];

export function switchArgs(targetSpec: string): string[] {
  return ['switch', targetSpec, PROGRESS, '--noinput'];
}
