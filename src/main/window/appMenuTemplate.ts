import type { MenuItemConstructorOptions } from 'electron';
import { revealLabel } from '@shared/revealLabel';

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
  reportIssue: () => void;
  requestFeature: () => void;
  /**
   * About with no window to show the app's dialog in (macOS keeps running with every window closed): the OS's panel,
   * which reads the name and version from the app bundle.
   */
  showAboutPanel: () => void;
  /** Checks for updates with no window to hear the answer in: an update found shows in the next window. */
  checkForUpdates: () => void;
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
  const { platform, isPackaged, windowItems, newWindow, openDocumentation, reportIssue, requestFeature, showAboutPanel, checkForUpdates } = context;
  const isMac = platform === 'darwin';
  const label = (text: string): string => (isMac ? text.replaceAll('&', '') : text);
  const commandItem: AppMenuContext['commandItem'] = (text, commandId, accelerator, withoutWindow) =>
    context.commandItem(label(text), commandId, accelerator && shownAccelerator(accelerator, isMac), withoutWindow);
  const separator: MenuItemConstructorOptions = { type: 'separator' };
  const aboutItem = commandItem('&About Unity Version Control', 'app.about', undefined, showAboutPanel);
  const checkForUpdatesItem = commandItem('Check for &Updates…', 'app.checkForUpdates', undefined, checkForUpdates);

  const template: MenuItemConstructorOptions[] = [
    {
      label: label('&File'),
      submenu: [
        commandItem('New &Window', 'app.newWindow', 'CmdOrCtrl+N', newWindow),
        // With every window closed (macOS), Home opens a window on it.
        commandItem('&Home', 'app.home', 'CmdOrCtrl+Shift+H', newWindow),
        commandItem('New Workspace for a &Task…', 'workspace.newForTask'),
        commandItem('&Open Another Workspace…', 'workspace.open', 'CmdOrCtrl+Shift+O'),
        separator,
        commandItem('Open in &Editor', 'workspace.openInEditor'),
        commandItem('Open in &Terminal', 'workspace.openTerminal'),
        commandItem(revealLabel(platform), 'workspace.reveal'),
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
        commandItem('Toggle &Sidebar', 'app.sidebar', 'CmdOrCtrl+\\'),
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
      label: label('&Branch'),
      submenu: [
        commandItem('&Switch Branch…', 'branch.switch', 'CmdOrCtrl+Shift+W'),
        commandItem('&New Branch…', 'branch.new', 'CmdOrCtrl+B'),
        separator,
        commandItem('&Merge from Branch…', 'merge.fromBranch', 'CmdOrCtrl+Shift+M'),
        commandItem('Merge Current Branch &into…', 'merge.toBranch'),
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
        commandItem('&Keyboard Shortcuts', 'app.shortcuts'),
        { label: label('&Report an Issue'), click: reportIssue },
        { label: label('Request a &Feature'), click: requestFeature },
        ...(isMac ? [] : [separator, checkForUpdatesItem, aboutItem]),
      ],
    },
  ];

  if (!isMac) return template;
  return [
    {
      role: 'appMenu',
      submenu: [
        aboutItem,
        checkForUpdatesItem,
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
