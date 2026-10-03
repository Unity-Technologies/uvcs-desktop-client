import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it } from 'vitest';
import { appMenuTemplate, shownAccelerator, type AppMenuContext } from './appMenuTemplate';

function templateOn(platform: NodeJS.Platform, links: Partial<AppMenuContext> = {}): MenuItemConstructorOptions[] {
  return appMenuTemplate({
    platform,
    isPackaged: true,
    commandItem: (label, commandId, accelerator) => ({ id: commandId, label, accelerator }),
    windowItems: [{ label: 'Home', type: 'checkbox' }],
    newWindow: () => {},
    openDocumentation: () => {},
    reportIssue: () => {},
    requestFeature: () => {},
    showAboutPanel: () => {},
    checkForUpdates: () => {},
    ...links,
  });
}

const submenuOf = (menu: MenuItemConstructorOptions): MenuItemConstructorOptions[] => (menu.submenu ?? []) as MenuItemConstructorOptions[];
const topLabels = (platform: NodeJS.Platform) => templateOn(platform).map((menu) => menu.label ?? menu.role);
const itemsOf = (platform: NodeJS.Platform, menu: string) => submenuOf(templateOn(platform).find((candidate) => candidate.label?.replaceAll('&', '') === menu)!);
const hasRole = (items: MenuItemConstructorOptions[], role: string) => items.some((item) => item.role === role);

describe('appMenuTemplate', () => {
  it('puts the app menu first on macOS only', () => {
    expect(topLabels('darwin')).toEqual(['appMenu', 'File', 'Edit', 'View', 'Branch', 'Window', 'Help']);
    expect(topLabels('win32')).toEqual(['&File', '&Edit', '&View', '&Branch', '&Window', '&Help']);
    expect(topLabels('linux')).toEqual(['&File', '&Edit', '&View', '&Branch', '&Window', '&Help']);
  });

  it('ends the File menu with Settings and Exit on Windows, Settings and Quit on Linux', () => {
    const windows = itemsOf('win32', 'File');
    expect(windows.at(-1)).toMatchObject({ role: 'quit', label: 'E&xit' });
    expect(windows.find((item) => item.id === 'app.settings')).toMatchObject({ label: '&Settings…', accelerator: undefined });
    const linux = itemsOf('linux', 'File');
    expect(linux.at(-1)).toMatchObject({ role: 'quit', label: '&Quit' });
    expect(linux.some((item) => item.id === 'app.settings')).toBe(true);
  });

  it('zooms in with Ctrl+= as well off macOS, where Ctrl+Plus takes Shift', () => {
    for (const platform of ['win32', 'linux'] as const) {
      expect(itemsOf(platform, 'View').filter((item) => item.role === 'zoomIn')).toEqual([{ role: 'zoomIn' }, { role: 'zoomIn', accelerator: 'Ctrl+=', visible: false }]);
    }
    expect(itemsOf('darwin', 'View').filter((item) => item.role === 'zoomIn')).toEqual([{ role: 'zoomIn' }]);
  });

  it('keeps Settings and Quit in the app menu on macOS', () => {
    const appMenu = submenuOf(templateOn('darwin')[0]!);
    expect(appMenu.find((item) => item.id === 'app.settings')).toMatchObject({ label: 'Settings…' });
    expect(hasRole(appMenu, 'quit')).toBe(true);
    expect(itemsOf('darwin', 'File').some((item) => item.id === 'app.settings' || item.role === 'quit')).toBe(false);
  });

  it("puts the app's About dialog and Check for Updates in Help off macOS, and first in the app menu on macOS", () => {
    const ids = (items: MenuItemConstructorOptions[]) => items.map((item) => item.id).filter(Boolean);
    expect(ids(itemsOf('win32', 'Help')).slice(-2)).toEqual(['app.checkForUpdates', 'app.about']);
    expect(ids(itemsOf('linux', 'Help')).slice(-2)).toEqual(['app.checkForUpdates', 'app.about']);
    expect(ids(itemsOf('darwin', 'Help'))).toEqual(['app.shortcuts']);
    expect(submenuOf(templateOn('darwin')[0]!).slice(0, 2)).toMatchObject([
      { id: 'app.about', label: 'About Unity Version Control' },
      { id: 'app.checkForUpdates', label: 'Check for Updates…' },
    ]);
    expect(hasRole(submenuOf(templateOn('darwin')[0]!), 'about')).toBe(false);
  });

  it('reports an issue and requests a feature from Help, each on its own form', () => {
    const opened: string[] = [];
    const help = submenuOf(
      templateOn('win32', { reportIssue: () => opened.push('bug report'), requestFeature: () => opened.push('feature request') }).find((menu) => menu.label === '&Help')!,
    );
    const click = (label: string) => (help.find((item) => item.label === label)!.click as () => void)();

    click('&Report an Issue');
    click('Request a &Feature');
    expect(opened).toEqual(['bug report', 'feature request']);
  });

  it('goes Home, creates and opens workspaces from File, and leaves updating one to the incoming chip', () => {
    const ids = itemsOf('darwin', 'File').map((item) => item.id).filter(Boolean);
    expect(ids).toEqual(['app.newWindow', 'app.home', 'workspace.newForTask', 'workspace.open', 'workspace.openInEditor', 'workspace.openTerminal', 'workspace.openInFileManager']);
  });

  it("opens the workspace from File in each OS's file manager", () => {
    const openIn = (platform: NodeJS.Platform) => itemsOf(platform, 'File').find((item) => item.id === 'workspace.openInFileManager')?.label;
    expect(openIn('darwin')).toBe('Open in Finder');
    expect(openIn('win32')).toBe('Open in Explorer');
    expect(openIn('linux')).toBe('Open in file manager');
  });

  it("offers the workspace's branch work in a Branch menu, with the keys the renderer binds", () => {
    expect(itemsOf('darwin', 'Branch').filter((item) => item.id)).toEqual([
      { id: 'branch.switch', label: 'Switch Branch…', accelerator: 'CmdOrCtrl+Shift+W' },
      { id: 'branch.new', label: 'New Branch…', accelerator: 'CmdOrCtrl+B' },
      { id: 'merge.fromBranch', label: 'Merge from Branch…', accelerator: 'CmdOrCtrl+Shift+M' },
      { id: 'merge.toBranch', label: 'Merge Current Branch into…', accelerator: undefined },
    ]);
  });

  it('closes the window from File everywhere', () => {
    for (const platform of ['darwin', 'win32', 'linux'] as const) expect(hasRole(itemsOf(platform, 'File'), 'close')).toBe(true);
  });

  it('keeps the macOS-only window items to macOS', () => {
    for (const platform of ['win32', 'linux'] as const) {
      const items = itemsOf(platform, 'Window');
      expect(hasRole(items, 'zoom')).toBe(false);
      expect(hasRole(items, 'front')).toBe(false);
    }
    expect(hasRole(itemsOf('darwin', 'Window'), 'zoom')).toBe(true);
  });

  it('marks the Alt letters off macOS and drops the marks on macOS', () => {
    const labels = (platform: NodeJS.Platform) =>
      templateOn(platform).flatMap((menu) => [menu.label ?? '', ...submenuOf(menu).map((item) => item.label ?? '')]);
    expect(labels('darwin').filter((label) => label.includes('&'))).toEqual([]);
    expect(itemsOf('win32', 'View').map((item) => item.label).filter(Boolean)).toEqual(['Command &Palette…', 'Command &Log', 'Toggle &Sidebar', '&Refresh']);
  });

  it('shows no accelerator Chromium would spell out off macOS ("Ctrl+Comma"), and every one on macOS', () => {
    expect(shownAccelerator('CmdOrCtrl+,', false)).toBeUndefined();
    expect(shownAccelerator('CmdOrCtrl+.', false)).toBeUndefined();
    expect(shownAccelerator('CmdOrCtrl+,', true)).toBe('CmdOrCtrl+,');
    expect(shownAccelerator('CmdOrCtrl+Shift+L', false)).toBe('CmdOrCtrl+Shift+L');
    expect(submenuOf(templateOn('darwin')[0]!).find((item) => item.id === 'app.settings')).toMatchObject({ accelerator: 'CmdOrCtrl+,' });
  });
});
