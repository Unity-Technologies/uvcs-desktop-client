/**
 * Menu commands the renderer registers only inside a workspace (`useWorkspaceCommands`, `useBranchCommands`,
 * `useMergeCommands`): their items are disabled while the focused window shows the home screen, where they would do
 * nothing.
 */
export const WORKSPACE_MENU_COMMANDS: readonly string[] = [
  'workspace.newForTask',
  'workspace.open',
  'workspace.openInEditor',
  'workspace.openTerminal',
  'workspace.openInFileManager',
  'workspace.refresh',
  'app.commandLog',
  'branch.switch',
  'branch.new',
  'merge.fromBranch',
  'merge.toBranch',
];

export function isMenuCommandEnabled(commandId: string, showsWorkspace: boolean): boolean {
  return showsWorkspace || !WORKSPACE_MENU_COMMANDS.includes(commandId);
}
