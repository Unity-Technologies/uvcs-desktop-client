import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { sendEvent } from '../ipc/sendEvent';

const DOCUMENTATION_URL = 'https://docs.unity.com/ugs/en-us/manual/devops/manual';

/**
 * A menu item that runs a renderer command. The renderer owns the keyboard shortcut,
 * so the accelerator is only displayed here (not registered) to avoid handling keys twice.
 */
function commandItem(label: string, commandId: string, accelerator?: string): MenuItemConstructorOptions {
  return {
    label,
    accelerator,
    registerAccelerator: false,
    click: () => sendEvent('menuCommand', { commandId }),
  };
}

export function installAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            role: 'appMenu' as const,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              commandItem('Settings…', 'app.settings', 'CmdOrCtrl+,'),
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        commandItem('Open Workspace…', 'workspace.open', 'CmdOrCtrl+Shift+O'),
        commandItem('Update Workspace', 'workspace.update', 'CmdOrCtrl+Shift+U'),
        { type: 'separator' },
        ...(isMac ? [] : [commandItem('Settings…', 'app.settings', 'CmdOrCtrl+,'), { type: 'separator' as const }]),
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        commandItem('Command Palette…', 'app.commandPalette', 'CmdOrCtrl+K'),
        commandItem('Command Log', 'app.commandLog', 'CmdOrCtrl+Shift+L'),
        commandItem('Refresh', 'workspace.refresh', 'CmdOrCtrl+R'),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ type: 'separator' as const }, { role: 'reload' as const }, { role: 'toggleDevTools' as const }]),
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'Unity Version Control Documentation', click: () => void shell.openExternal(DOCUMENTATION_URL) }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
