import type { Place } from '@shared/domain/place';

/**
 * Menu commands the renderer registers only inside a place (`usePlaceCommands`) or a workspace (`useWorkspaceCommands`,
 * `useBranchCommands`, `useMergeCommands`): their items are disabled while the focused window shows the home screen, where they would do
 * nothing. Those the home screen registers too (`useHomeCommands`: Home, Open Workspace…, Refresh) stay enabled.
 */
export const WORKSPACE_MENU_COMMANDS: readonly string[] = [
  'workspace.newForTask',
  'workspace.openInEditor',
  'workspace.openTerminal',
  'workspace.openInFileManager',
  'app.commandLog',
  'branch.switch',
  'branch.new',
  'merge.fromBranch',
  'merge.toBranch',
];

/**
 * Those of them a window exploring a repository without a workspace registers too, as every place does
 * (`usePlaceCommands`). The others switch, merge, branch from what the workspace loaded or open its files.
 */
export const REPOSITORY_MENU_COMMANDS: readonly string[] = ['app.commandLog'];

/** Whether the menu item runs a command in the focused window, by the place it shows (none: the home screen, or no window). */
export function isMenuCommandEnabled(commandId: string, shown: Place | undefined): boolean {
  if (!WORKSPACE_MENU_COMMANDS.includes(commandId)) return true;
  if (shown === undefined) return false;
  return shown.kind === 'workspace' || REPOSITORY_MENU_COMMANDS.includes(commandId);
}
