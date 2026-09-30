import { changesWorkspace } from '../watch/changesWorkspace';

/** Commands that move data to or from the server however few files they name. */
const TRANSFERS = new Set(['checkin', 'ci', 'merge', 'switch', 'update']);
const RECURSIVE_FLAGS = new Set(['-r', '-R', '--recursive']);
/** A workspace write of more paths than this can take seconds to minutes (undoing 20,000 files takes minutes). */
export const MAX_QUICK_WRITE_PATHS = 50;

/**
 * Whether a command may run long enough that it must not hold one of a workspace's two pooled `cm shell` sessions,
 * where every read of that workspace would wait behind it: a workspace write that transfers data, recurses into
 * folders or names many paths. Reads and small writes stay quick: a warm `cm shell` answers them in a few ms, while a
 * process of their own would first spend 100-150 ms starting `cm`.
 */
export function runsLong(args: readonly string[]): boolean {
  if (!changesWorkspace(args)) return false;
  const [command = ''] = args;
  if (TRANSFERS.has(command)) return true;
  if (args.some((arg) => RECURSIVE_FLAGS.has(arg))) return true;
  return namedPaths(args) > MAX_QUICK_WRITE_PATHS;
}

/** Every argument after the command that isn't an option: the paths, and a changelist's name and verb. */
function namedPaths(args: readonly string[]): number {
  return args.slice(1).filter((arg) => !arg.startsWith('-')).length;
}
