import { describe, expect, it, vi } from 'vitest';
import { AUTO_APP } from '@shared/domain/externalApps';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { ExternalAppsCatalog } from './ExternalAppsCatalog';
import { InstalledAppsCache, NO_INSTALLED_APPS, type InstalledApps } from './installedApps';
import type { LaunchCommand } from './launchCommand';
import { fakeFileSystem, installedOnMac, mac } from './testing/appFixtures';

const ON_THIS_MAC = installedOnMac({
  'com.microsoft.VSCode': '/Applications/Visual Studio Code.app',
  'dev.zed.Zed': '/Applications/Zed.app',
  'com.apple.Terminal': '/System/Applications/Utilities/Terminal.app',
});

function catalog(settings: Partial<AppSettings> = {}, installed: InstalledApps = ON_THIS_MAC) {
  const launched: LaunchCommand[] = [];
  const read = vi.fn(async () => installed);
  const apps = new ExternalAppsCatalog({
    installedApps: new InstalledAppsCache(read, () => 0),
    settings: { get: () => ({ ...DEFAULT_SETTINGS, ...settings }) },
    where: () => mac,
    fs: fakeFileSystem([]),
    launch: async (command) => void launched.push(command),
  });
  return { apps, launched, read };
}

describe('ExternalAppsCatalog', () => {
  it("opens a path in the user's editor, or in the one asked for", async () => {
    const { apps, launched } = catalog({ editor: 'zed' });
    await apps.openInEditor('/wk/a.cs');
    await apps.openInEditor('/wk/b.cs', 'vscode');
    expect(launched.map(({ args }) => args)).toEqual([
      ['-a', '/Applications/Zed.app', '/wk/a.cs'],
      ['-a', '/Applications/Visual Studio Code.app', '/wk/b.cs'],
    ]);
  });

  it('opens a folder in the automatic terminal', async () => {
    const { apps, launched } = catalog({ terminal: AUTO_APP });
    await apps.openInTerminal('/wk');
    expect(launched).toEqual([{ command: 'open', args: ['-a', '/System/Applications/Utilities/Terminal.app', '/wk'], exits: true }]);
  });

  it('says so when there is no editor at all, or the one asked for is gone, and opens nothing', async () => {
    const { apps, launched } = catalog({}, NO_INSTALLED_APPS);
    await expect(apps.openInEditor('/wk/a.cs')).rejects.toThrow('No app to open it in was found. Add one in Settings.');
    await expect(catalog().apps.openInEditor('/wk/a.cs', 'rider')).rejects.toThrow("That app isn't installed anymore.");
    expect(launched).toEqual([]);
  });

  it('reads what the OS has installed once for a list and the opens that follow it', async () => {
    const { apps, read } = catalog();
    await apps.list();
    await apps.openInEditor('/wk/a.cs');
    await apps.openInTerminal('/wk');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("lists the user's own editors and picks", async () => {
    const list = await catalog({ editor: 'custom:1', customEditors: [{ id: 'custom:1', name: 'Mine', executable: '/Applications/Mine.app' }] }).apps.list();
    expect(list.editors.map(({ id }) => id)).toEqual(['vscode', 'zed', 'custom:1']);
    expect(list.editorId).toBe('custom:1');
  });
});
