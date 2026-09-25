const WORKSPACE_WRITES = new Set([
  'add',
  'checkin',
  'ci',
  'checkout',
  'co',
  'changerevisiontype',
  'move',
  'mv',
  'remove',
  'rm',
  'revert',
  'switch',
  'undo',
  'undocheckout',
  'unco',
  'update',
]);

/**
 * Whether a `cm` command rewrites the workspace (its files or `.plastic`). The app refreshes its views after its
 * own writes, so the file system events they cause are not worth a second refresh.
 */
export function changesWorkspace(args: readonly string[]): boolean {
  const [command = '', subcommand] = args;
  if (WORKSPACE_WRITES.has(command)) return true;
  // Without `--merge`, `cm merge` only previews.
  if (command === 'merge') return args.includes('--merge');
  if (command === 'shelveset') return subcommand === 'apply' && !args.includes('--preview');
  // `cm changelist` alone lists them.
  if (command === 'changelist') return subcommand !== undefined;
  return false;
}
