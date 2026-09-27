import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it } from 'vitest';
import { appMenuTemplate } from './appMenuTemplate';

function templateOn(platform: NodeJS.Platform): MenuItemConstructorOptions[] {
  return appMenuTemplate({
    platform,
    isPackaged: true,
    commandItem: (label, commandId, accelerator) => ({ id: commandId, label, accelerator }),
    windowItems: [{ label: 'Home', type: 'checkbox' }],
    newWindow: () => {},
    openDocumentation: () => {},
  });
}

const submenuOf = (menu: MenuItemConstructorOptions): MenuItemConstructorOptions[] => (menu.submenu ?? []) as MenuItemConstructorOptions[];
const topLabels = (platform: NodeJS.Platform) => templateOn(platform).map((menu) => menu.label ?? menu.role);
const itemsOf = (platform: NodeJS.Platform, menu: string) => submenuOf(templateOn(platform).find((candidate) => candidate.label?.replace('&', '') === menu)!);
const hasRole = (items: MenuItemConstructorOptions[], role: string) => items.some((item) => item.role === role);

describe('appMenuTemplate', () => {
  it('puts the app menu first on macOS only', () => {
    expect(topLabels('darwin')).toEqual(['appMenu', 'File', 'Edit', 'View', 'Window', 'Help']);
    expect(topLabels('win32')).toEqual(['&File', '&Edit', '&View', '&Window', '&Help']);
    expect(topLabels('linux')).toEqual(['&File', '&Edit', '&View', '&Window', '&Help']);
  });

  it('ends the File menu with Settings and Exit on Windows, Settings and Quit on Linux', () => {
    const windows = itemsOf('win32', 'File');
    expect(windows.at(-1)).toMatchObject({ role: 'quit', label: 'E&xit' });
    expect(windows.find((item) => item.id === 'app.settings')).toMatchObject({ label: '&Settings…', accelerator: 'CmdOrCtrl+,' });
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

  it('puts About in Help off macOS, and in the app menu on macOS', () => {
    expect(hasRole(itemsOf('win32', 'Help'), 'about')).toBe(true);
    expect(hasRole(itemsOf('linux', 'Help'), 'about')).toBe(true);
    expect(hasRole(itemsOf('darwin', 'Help'), 'about')).toBe(false);
    expect(hasRole(submenuOf(templateOn('darwin')[0]!), 'about')).toBe(true);
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
    expect(itemsOf('win32', 'View').map((item) => item.label).filter(Boolean)).toEqual(['Command &Palette…', 'Command &Log', '&Refresh']);
  });
});
