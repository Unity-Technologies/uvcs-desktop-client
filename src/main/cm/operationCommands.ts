import { changesWorkspace } from '../watch/changesWorkspace';

/**
 * Whether a command is an operation: it changes the workspace (`changesWorkspace`: checkin, undo, update, switch, a
 * merge...), shelves changes or syncs a repository. Reads, a merge's preview and the checks (`checkconnection`,
 * `version`) are none.
 */
export function isOperation(args: readonly string[]): boolean {
  const [command = '', subcommand] = args;
  if (changesWorkspace(args)) return true;
  if (command === 'shelveset') return subcommand === 'create';
  return command === 'sync';
}
