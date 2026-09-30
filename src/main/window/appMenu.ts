import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { sendEventTo } from '../ipc/sendEvent';
import { DOCUMENTATION_URL } from './appInfo';
import { appMenuTemplate } from './appMenuTemplate';
import { isMenuCommandEnabled } from './workspaceMenuCommands';
import type { AppUpdates } from '../update/AppUpdates';
import { focusWindow, type WorkspaceWindows } from './WorkspaceWindows';

/**
 * A menu item that runs a renderer command in the focused window. The renderer owns the keyboard shortcut,
 * so the accelerator is only displayed here (not registered) to avoid handling keys twice. `withoutWindow` runs
 * when no window has focus (on macOS every window can be closed), for items that still make sense then.
 */
function commandItem(label: string, commandId: string, accelerator?: string, withoutWindow?: () => void): MenuItemConstructorOptions {
  return {
    id: commandId,
    label,
    accelerator,
    registerAccelerator: false,
    click: (_item, window) => {
      if (window instanceof BrowserWindow) sendEventTo(window.webContents, 'menuCommand', { commandId });
      else withoutWindow?.();
    },
  };
}

/** The Window menu's list: every open window by the workspace it shows, the focused one checked. */
function windowItems(windows: WorkspaceWindows): MenuItemConstructorOptions[] {
  const focused = BrowserWindow.getFocusedWindow();
  return windows.all().map((window) => ({
    label: windows.workspaceIn(window) ? window.getTitle() : 'Home',
    type: 'checkbox',
    checked: window === focused,
    click: () => focusWindow(window),
  }));
}

/** Installs the menu bar; call it again when windows open, close, get focus or change title. */
export function installAppMenu(windows: WorkspaceWindows, updates: AppUpdates): void {
  const template = appMenuTemplate({
    platform: process.platform,
    isPackaged: app.isPackaged,
    commandItem,
    windowItems: windowItems(windows),
    newWindow: () => windows.open(),
    openDocumentation: () => void shell.openExternal(DOCUMENTATION_URL),
    showAboutPanel: () => app.showAboutPanel(),
    checkForUpdates: () => void updates.check(),
  });

  const menu = Menu.buildFromTemplate(template);
  // A window on the home screen (or none) has no workspace commands to run.
  const focused = BrowserWindow.getFocusedWindow();
  const showsWorkspace = Boolean(focused && windows.workspaceIn(focused));
  for (const item of menuItems(menu)) if (item.id && !item.role) item.enabled = isMenuCommandEnabled(item.id, showsWorkspace);
  Menu.setApplicationMenu(menu);
}

/** The menu bar, and the Dock icon's menu on macOS. */
export function installMenus(windows: WorkspaceWindows, updates: AppUpdates): void {
  installAppMenu(windows, updates);
  installDockMenu(windows);
}

/**
 * The Dock icon's menu on macOS gets New Window, even with every window closed; the system puts the recent workspaces
 * above it (`recentDocuments`) and the open windows below.
 */
function installDockMenu(windows: WorkspaceWindows): void {
  app.dock?.setMenu(Menu.buildFromTemplate([{ label: 'New Window', click: () => windows.open() }]));
}

/**
 * Opens the menu bar's menus as a popup under the window's menu button, where the window has no menu bar (Windows).
 * `position` is in page pixels, which the View menu's zoom scales.
 */
export function popUpAppMenu(window: BrowserWindow, position: { x: number; y: number }): void {
  const zoom = window.webContents.getZoomFactor();
  Menu.getApplicationMenu()?.popup({ window, x: Math.round(position.x * zoom), y: Math.round(position.y * zoom) });
}

function menuItems(menu: Menu): Electron.MenuItem[] {
  return menu.items.flatMap((item) => [item, ...(item.submenu ? menuItems(item.submenu) : [])]);
}
