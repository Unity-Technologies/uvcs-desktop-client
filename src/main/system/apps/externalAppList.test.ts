import { describe, expect, it } from 'vitest';
import { AUTO_APP } from '@shared/domain/externalApps';
import { externalAppList, type ExternalAppSources } from './externalAppList';
import { fakeFileSystem, installedOnMac, mac, windows } from './testing/appFixtures';
import { NO_INSTALLED_APPS } from './installedApps';

const installed = installedOnMac({
  'com.microsoft.VSCode': '/Applications/Visual Studio Code.app',
  'com.jetbrains.rider': '/Applications/Rider.app',
  'com.apple.Terminal': '/System/Applications/Utilities/Terminal.app',
  'com.googlecode.iterm2': '/Applications/iTerm.app',
});
const sources = (parts: Partial<ExternalAppSources> = {}): ExternalAppSources => ({
  where: mac,
  installed,
  fs: fakeFileSystem([]),
  custom: [],
  editorPreference: AUTO_APP,
  terminalPreference: AUTO_APP,
  ...parts,
});

describe('externalAppList', () => {
  it("lists the editors and this platform's terminals found, and the user's own editors after them", () => {
    const { apps } = externalAppList(sources({ custom: [{ id: 'custom:1', name: 'My Editor', executable: '/opt/edit' }] }));
    expect(apps.editors.map(({ id, origin, opensFolders }) => [id, origin, opensFolders])).toEqual([
      ['vscode', 'known', true],
      ['rider', 'known', true],
      ['custom:1', 'custom', true],
    ]);
    expect(apps.terminals.map(({ id, location }) => [id, location])).toEqual([
      ['terminal', '/System/Applications/Utilities/Terminal.app'],
      ['iterm', '/Applications/iTerm.app'],
    ]);
  });

  it('uses the first editor and the usual terminal automatically, and the user’s choice while it is there', () => {
    expect(externalAppList(sources()).apps).toMatchObject({ editorId: 'vscode', terminalId: 'terminal' });
    expect(externalAppList(sources({ editorPreference: 'rider', terminalPreference: 'iterm' })).apps).toMatchObject({ editorId: 'rider', terminalId: 'iterm' });
    expect(externalAppList(sources({ editorPreference: 'zed', terminalPreference: 'ghostty' })).apps).toMatchObject({ editorId: 'vscode', terminalId: 'terminal' });
  });

  it('uses no editor when the user opens each file with its default app', () => {
    expect(externalAppList(sources({ editorPreference: 'system' })).apps).toMatchObject({ editorId: null, terminalId: 'terminal' });
    expect(externalAppList(sources({ editorPreference: 'system' })).apps.editors.map(({ id }) => id)).toEqual(['vscode', 'rider']);
  });

  it('has no editor to use when none is found but the user added one, then that one', () => {
    expect(externalAppList(sources({ installed: NO_INSTALLED_APPS })).apps.editorId).toBeNull();
    expect(externalAppList(sources({ installed: NO_INSTALLED_APPS, custom: [{ id: 'custom:1', name: 'Mine', executable: '/opt/edit' }] })).apps.editorId).toBe('custom:1');
  });

  it("opens with the user's macOS app bundle as Finder would, and runs any other program on the path", () => {
    const custom = [
      { id: 'custom:1', name: 'Mine', executable: '/Applications/Mine.app' },
      { id: 'custom:2', name: 'Script', executable: '/opt/edit' },
    ];
    const { launchers } = externalAppList(sources({ custom }));
    expect(launchers.get('custom:1')!('/wk/a.cs')).toEqual({ command: 'open', args: ['-a', '/Applications/Mine.app', '/wk/a.cs'], exits: true });
    expect(launchers.get('custom:2')!('/wk/a.cs')).toEqual({ command: '/opt/edit', args: ['/wk/a.cs'], exits: false });
    const onWindows = externalAppList(sources({ where: windows, installed: NO_INSTALLED_APPS, custom: [{ id: 'custom:3', name: 'Cmd', executable: 'C:\\tools\\edit.cmd' }] }));
    expect(onWindows.launchers.get('custom:3')!('C:\\wk\\a.cs')).toMatchObject({ command: 'cmd.exe', verbatim: true });
  });
});
