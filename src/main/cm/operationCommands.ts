import { changesWorkspace } from '../watch/changesWorkspace';

/**
 * Whether a command is an operation: it changes the workspace (`changesWorkspace`: checkin, undo, update, switch, a
 * merge...), shelves changes, or syncs, pushes or pulls a repository. Reads, a merge's preview and the checks (`checkconnection`,
 * `version`) are none.
 */
export function isOperation(args: readonly string[]): boolean {
  if (changesWorkspace(args)) return true;
  // `cm partial shelveset create` shelves as `cm shelveset create` does.
  const [command = '', subcommand] = args[0] === 'partial' ? args.slice(1) : args;
  if (command === 'shelveset') return subcommand === 'create';
  return command === 'sync' || command === 'push' || command === 'pull';
}
