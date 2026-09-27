/**
 * Menu commands the renderer registers only inside a workspace (`useWorkspaceCommands`): their items are disabled
 * while the focused window shows the home screen, where they would do nothing.
 */
export const WORKSPACE_MENU_COMMANDS: readonly string[] = ['workspace.open', 'workspace.update', 'workspace.refresh', 'app.commandLog'];

export function isMenuCommandEnabled(commandId: string, showsWorkspace: boolean): boolean {
  return showsWorkspace || !WORKSPACE_MENU_COMMANDS.includes(commandId);
}
