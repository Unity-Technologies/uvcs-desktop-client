import type { BaseWindow, MenuItemConstructorOptions } from 'electron';
import { openInFileManagerLabel } from '@shared/revealLabel';
import type { Keymap } from '@shared/shortcuts/keymap';
import { menuAccelerator } from '@shared/shortcuts/menuAccelerator';
import type { PageZoomChange } from './pageZoom';

export interface AppMenuContext {
  platform: NodeJS.Platform;
  /** Development builds add Reload and the developer tools. */
  isPackaged: boolean;
  /** A menu item that runs a renderer command in the focused window (`withoutWindow` when no window has focus). */
  commandItem: (label: string, commandId: string, accelerator?: string, withoutWindow?: () => void) => MenuItemConstructorOptions;
  /** The keys of the app's shortcuts on this OS, a person's choices included: the items show their command's. */
  keymap: Keymap;
  /** The Window menu's items for the open windows. */
  windowItems: MenuItemConstructorOptions[];
  newWindow: () => void;
  openDocumentation: () => void;
  reportIssue: () => void;
  /** Shows the log file (`appLog`) in the OS's file manager, for the user to attach to a bug report. */
  showLogFiles: () => void;
  /** Shows the `cm` the app runs in the file manager: its own (docs/features/cm-runtime.md), or the one installed. */
  showCmClient: () => void;
  requestFeature: () => void;
  /**
   * About with no window to show the app's dialog in (macOS keeps running with every window closed): the OS's panel,
   * which reads the name and version from the app bundle.
   */
  showAboutPanel: () => void;
  /** Checks for updates with no window to hear the answer in: an update found shows in the next window. */
  checkForUpdates: () => void;
  /** Zooms the page of the window the item was chosen in (`zoomPage`), the window's controls following it. */
  zoomPage: (window: BaseWindow | undefined, change: PageZoomChange) => void;
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
  const { platform, isPackaged, windowItems, newWindow, openDocumentation, reportIssue, showLogFiles, showCmClient, requestFeature, showAboutPanel, checkForUpdates, zoomPage } = context;
  const isMac = platform === 'darwin';
  const label = (text: string): string => (isMac ? text.replaceAll('&', '') : text);
  const commandItem = (text: string, commandId: string, withoutWindow?: () => void): MenuItemConstructorOptions => {
    const accelerator = menuAccelerator(context.keymap, commandId);
    return context.commandItem(label(text), commandId, accelerator && shownAccelerator(accelerator, isMac), withoutWindow);
  };
  const separator: MenuItemConstructorOptions = { type: 'separator' };
  const aboutItem = commandItem('&About Unity Version Control', 'app.about', showAboutPanel);
  const checkForUpdatesItem = commandItem('Check for &Updates…', 'app.checkForUpdates', checkForUpdates);
  // Not Electron's zoom roles: the window's controls follow the zoom, which the roles change without telling.
  const zoomItem = (text: string, change: PageZoomChange, accelerator: string): MenuItemConstructorOptions => ({
    label: label(text),
    accelerator,
    click: (_item, window) => zoomPage(window, change),
  });

  const template: MenuItemConstructorOptions[] = [
    {
      label: label('&File'),
      submenu: [
        commandItem('New &Window', 'app.newWindow', newWindow),
        // With every window closed (macOS), Home opens a window on it.
        commandItem('&Home', 'app.home', newWindow),
        commandItem('New Workspace for a &Task…', 'workspace.newForTask'),
        commandItem('&Open Another Workspace…', 'workspace.open'),
        commandItem('Open &Link…', 'app.openLink'),
        separator,
        commandItem('Open in &Editor', 'workspace.openInEditor'),
        commandItem('Open in &Terminal', 'workspace.openTerminal'),
        commandItem(openInFileManagerLabel(platform), 'workspace.openInFileManager'),
        separator,
        ...(isMac ? [] : [commandItem('&Settings…', 'app.settings'), separator]),
        { role: 'close', label: label('&Close Window') },
        ...(isMac ? [] : [{ role: 'quit' as const, label: platform === 'win32' ? 'E&xit' : '&Quit' }]),
      ],
    },
    { role: 'editMenu', label: label('&Edit') },
    {
      label: label('&View'),
      submenu: [
        commandItem('Command &Palette…', 'app.commandPalette'),
        commandItem('Command &Log', 'app.commandLog'),
        commandItem('Toggle &Sidebar', 'app.sidebar'),
        commandItem('Toggle &Details', 'view.details'),
        // The diff given the whole window, in the app: never the OS's full screen below, which it stacks with.
        commandItem('&Expand Diff', 'view.expandDiff'),
        commandItem('Branch Explorer &Timeline', 'branchExplorer.timeline'),
        commandItem('&Refresh', 'workspace.refresh'),
        separator,
        zoomItem('&Actual Size', 'reset', 'CmdOrCtrl+0'),
        zoomItem('Zoom &In', 'in', 'CmdOrCtrl+Plus'),
        // Ctrl+Plus needs Shift on most keyboards; Windows and Linux browsers zoom in with Ctrl+= too.
        ...(isMac ? [] : [{ ...zoomItem('Zoom &In', 'in', 'Ctrl+='), visible: false }]),
        zoomItem('Zoom &Out', 'out', 'CmdOrCtrl+-'),
        separator,
        { role: 'togglefullscreen' },
        ...(isPackaged ? [] : [separator, { role: 'reload' as const }, { role: 'toggleDevTools' as const }]),
      ],
    },
    {
      label: label('&Branch'),
      submenu: [
        commandItem('&Switch Branch…', 'branch.switch'),
        commandItem('&New Branch…', 'branch.new'),
        separator,
        commandItem('&Merge from Branch…', 'merge.fromBranch'),
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
        { label: label('Show &Log Files'), click: showLogFiles },
        { label: label('Show Command Line &Client'), click: showCmClient },
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
        commandItem('Settings…', 'app.settings'),
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
