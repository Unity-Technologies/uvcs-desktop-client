import type { MenuItemConstructorOptions } from 'electron';

export interface AppMenuContext {
  platform: NodeJS.Platform;
  /** Development builds add Reload and the developer tools. */
  isPackaged: boolean;
  /** A menu item that runs a renderer command in the focused window (`withoutWindow` when no window has focus). */
  commandItem: (label: string, commandId: string, accelerator?: string, withoutWindow?: () => void) => MenuItemConstructorOptions;
  /** The Window menu's items for the open windows. */
  windowItems: MenuItemConstructorOptions[];
  newWindow: () => void;
  openDocumentation: () => void;
}

/**
 * The accelerator a menu item shows. Off macOS, Chromium's menus spell a few keys out ("Ctrl+Comma", "Ctrl+Period")
 * where the rest of the app shows the key (Ctrl+,); those items show none, their shortcut still works (the renderer
 * owns the keys) and the tooltips, palette and shortcuts sheet tell it.
 */
export function shownAccelerator(accelerator: string, isMac: boolean): string | undefined {
  return !isMac && /\+[,.]$/.test(accelerator) ? undefined : accelerator;
}

/**
 * The menu bar of each OS: on macOS the app menu holds About, Settings and Quit; Windows and Linux have none, so
 * Settings and Exit (Windows) or Quit (Linux) end the File menu and About ends Help. Off macOS, `&` marks the letter
 * Alt opens an item with (the menu bar shows it underlined); macOS has no such letters, so they're dropped there.
 */
export function appMenuTemplate(context: AppMenuContext): MenuItemConstructorOptions[] {
  const { platform, isPackaged, windowItems, newWindow, openDocumentation } = context;
  const isMac = platform === 'darwin';
  const label = (text: string): string => (isMac ? text.replaceAll('&', '') : text);
  const commandItem: AppMenuContext['commandItem'] = (text, commandId, accelerator, withoutWindow) =>
    context.commandItem(label(text), commandId, accelerator && shownAccelerator(accelerator, isMac), withoutWindow);
  const separator: MenuItemConstructorOptions = { type: 'separator' };

  const template: MenuItemConstructorOptions[] = [
    {
      label: label('&File'),
      submenu: [
        commandItem('New &Window', 'app.newWindow', 'CmdOrCtrl+N', newWindow),
        commandItem('&Open Another Workspace…', 'workspace.open', 'CmdOrCtrl+Shift+O'),
        commandItem('&Update Workspace', 'workspace.update', 'CmdOrCtrl+Shift+U'),
        separator,
        ...(isMac ? [] : [commandItem('&Settings…', 'app.settings', 'CmdOrCtrl+,'), separator]),
        { role: 'close', label: label('&Close Window') },
        ...(isMac ? [] : [{ role: 'quit' as const, label: platform === 'win32' ? 'E&xit' : '&Quit' }]),
      ],
    },
    { role: 'editMenu', label: label('&Edit') },
    {
      label: label('&View'),
      submenu: [
        commandItem('Command &Palette…', 'app.commandPalette', 'CmdOrCtrl+K'),
        commandItem('Command &Log', 'app.commandLog', 'CmdOrCtrl+Shift+L'),
        commandItem('&Refresh', 'workspace.refresh', 'CmdOrCtrl+R'),
        separator,
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        // Ctrl+Plus needs Shift on most keyboards; Windows and Linux browsers zoom in with Ctrl+= too.
        ...(isMac ? [] : [{ role: 'zoomIn' as const, accelerator: 'Ctrl+=', visible: false }]),
        { role: 'zoomOut' },
        separator,
        { role: 'togglefullscreen' },
        ...(isPackaged ? [] : [separator, { role: 'reload' as const }, { role: 'toggleDevTools' as const }]),
      ],
    },
    {
      label: label('&Window'),
      submenu: [
        { role: 'minimize' },
        // Zoom is the green button's; Windows and Linux maximize from the title bar.
        ...(isMac ? [{ role: 'zoom' as const }] : []),
        separator,
        ...windowItems,
        ...(isMac ? [separator, { role: 'front' as const }] : []),
      ],
    },
    {
      role: 'help',
      label: label('&Help'),
      submenu: [
        { label: label('Unity Version Control &Documentation'), click: openDocumentation },
        ...(isMac ? [] : [separator, { role: 'about' as const, label: '&About Unity Version Control' }]),
      ],
    },
  ];

  if (!isMac) return template;
  return [
    {
      role: 'appMenu',
      submenu: [
        { role: 'about' },
        separator,
        commandItem('Settings…', 'app.settings', 'CmdOrCtrl+,'),
        separator,
        { role: 'services' },
        separator,
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        separator,
        { role: 'quit' },
      ],
    },
    ...template,
  ];
}
