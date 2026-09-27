import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { sendEventTo } from '../ipc/sendEvent';
import { appMenuTemplate } from './appMenuTemplate';
import { isMenuCommandEnabled } from './workspaceMenuCommands';
import { focusWindow, type WorkspaceWindows } from './WorkspaceWindows';

const DOCUMENTATION_URL = 'https://docs.unity.com/ugs/en-us/manual/devops/manual';

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
export function installAppMenu(windows: WorkspaceWindows): void {
  const template = appMenuTemplate({
    platform: process.platform,
    isPackaged: app.isPackaged,
    commandItem,
    windowItems: windowItems(windows),
    newWindow: () => windows.open(),
    openDocumentation: () => void shell.openExternal(DOCUMENTATION_URL),
  });

  const menu = Menu.buildFromTemplate(template);
  // A window on the home screen (or none) has no workspace commands to run.
  const focused = BrowserWindow.getFocusedWindow();
  const showsWorkspace = Boolean(focused && windows.workspaceIn(focused));
  for (const item of menuItems(menu)) if (item.id && !item.role) item.enabled = isMenuCommandEnabled(item.id, showsWorkspace);
  Menu.setApplicationMenu(menu);
}

function menuItems(menu: Menu): Electron.MenuItem[] {
  return menu.items.flatMap((item) => [item, ...(item.submenu ? menuItems(item.submenu) : [])]);
}
