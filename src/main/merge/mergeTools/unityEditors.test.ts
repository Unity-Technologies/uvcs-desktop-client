import { describe, expect, it } from 'vitest';
import { fakeFileSystem, linux, mac, windows } from '../../system/apps/testing/appFixtures';
import { findUnityEditors } from './unityEditors';

const MAC_HUB = '/Users/me/Library/Application Support/UnityHub';
const WINDOWS_HUB = 'C:\\Users\\me\\AppData\\Roaming\\UnityHub';
const LINUX_HUB = '/home/me/.config/UnityHub';

describe('findUnityEditors', () => {
  it('finds one editor per version in the Hub’s default folder, on each OS', () => {
    const macEditors = findUnityEditors(mac, fakeFileSystem(['/Applications/Unity/Hub/Editor/6000.3.19f1/Unity.app', '/Applications/Unity/Hub/Editor/2022.3.62f3/Unity.app']));
    expect(macEditors.filter((editor) => editor.version)).toEqual([
      { version: '6000.3.19f1', folder: '/Applications/Unity/Hub/Editor/6000.3.19f1/Unity.app' },
      { version: '2022.3.62f3', folder: '/Applications/Unity/Hub/Editor/2022.3.62f3/Unity.app' },
    ]);

    const windowsEditors = findUnityEditors(windows, fakeFileSystem(['C:\\Program Files\\Unity\\Hub\\Editor\\6000.0.77f1\\Editor\\Unity.exe']));
    expect(windowsEditors.filter((editor) => editor.version)).toEqual([{ version: '6000.0.77f1', folder: 'C:\\Program Files\\Unity\\Hub\\Editor\\6000.0.77f1\\Editor' }]);

    const linuxEditors = findUnityEditors(linux, fakeFileSystem(['/home/me/Unity/Hub/Editor/6000.0.77f1/Editor/Unity']));
    expect(linuxEditors).toEqual([{ version: '6000.0.77f1', folder: '/home/me/Unity/Hub/Editor/6000.0.77f1/Editor' }]);
  });

  it('finds the editors in the folder the user picked in the Hub instead of its default one', () => {
    const fs = fakeFileSystem(['/Volumes/Fast/Unity/6000.3.19f1/Unity.app'], {
      [`${MAC_HUB}/secondaryInstallPath.json`]: '"/Volumes/Fast/Unity"',
    });
    expect(findUnityEditors(mac, fs).filter((editor) => editor.version)).toEqual([{ version: '6000.3.19f1', folder: '/Volumes/Fast/Unity/6000.3.19f1/Unity.app' }]);

    const windowsFs = fakeFileSystem(['D:\\Unity\\6000.0.77f1\\Editor\\Unity.exe'], { [`${WINDOWS_HUB}\\secondaryInstallPath.json`]: '"D:\\\\Unity"' });
    expect(findUnityEditors(windows, windowsFs).filter((editor) => editor.version)).toEqual([{ version: '6000.0.77f1', folder: 'D:\\Unity\\6000.0.77f1\\Editor' }]);
  });

  it('finds the editors located by hand in the Hub, in either shape of its list', () => {
    const v2 = JSON.stringify({ schema_version: '2', data: [{ version: '6000.1.17f1', location: ['/Users/me/Unity/6000.1.17f1/Unity.app'], manual: true }] });
    const v1 = JSON.stringify({ '2021.3.45f2': { version: '2021.3.45f2', location: ['/home/me/editors/2021.3.45f2/Editor/Unity'], manual: true } });

    expect(findUnityEditors(mac, fakeFileSystem([], { [`${MAC_HUB}/editors-v2.json`]: v2 })).filter((editor) => editor.version)).toEqual([
      { version: '6000.1.17f1', folder: '/Users/me/Unity/6000.1.17f1/Unity.app' },
    ]);
    expect(findUnityEditors(linux, fakeFileSystem([], { [`${LINUX_HUB}/editors.json`]: v1 }))).toEqual([
      { version: '2021.3.45f2', folder: '/home/me/editors/2021.3.45f2/Editor' },
    ]);
  });

  it('reads the Hub’s config folder from XDG_CONFIG_HOME on Linux and APPDATA on Windows when they are set', () => {
    const v1 = JSON.stringify({ '6000.0.1f1': { version: '6000.0.1f1', location: '/opt/unity/Editor/Unity' } });
    const xdg = { ...linux, env: { ...linux.env, XDG_CONFIG_HOME: '/home/me/config' } };
    expect(findUnityEditors(xdg, fakeFileSystem([], { '/home/me/config/UnityHub/editors.json': v1 }))).toEqual([{ version: '6000.0.1f1', folder: '/opt/unity/Editor' }]);

    const roaming = { ...windows, env: { ...windows.env, APPDATA: 'E:\\Roaming' } };
    const v2 = JSON.stringify({ data: [{ version: '6000.0.1f1', location: ['E:\\Unity\\Editor\\Unity.exe'] }] });
    expect(findUnityEditors(roaming, fakeFileSystem([], { 'E:\\Roaming\\UnityHub\\editors-v2.json': v2 })).filter((editor) => editor.version)).toEqual([
      { version: '6000.0.1f1', folder: 'E:\\Unity\\Editor' },
    ]);
  });

  it('ignores Hub files it can’t read: broken JSON, an empty install folder, entries without a location', () => {
    const fs = fakeFileSystem([], {
      [`${LINUX_HUB}/secondaryInstallPath.json`]: '""',
      [`${LINUX_HUB}/editors-v2.json`]: '{ broken',
      [`${LINUX_HUB}/editors.json`]: JSON.stringify({ '6000.0.1f1': { version: '6000.0.1f1' }, other: 3 }),
    });
    expect(findUnityEditors(linux, fs)).toEqual([]);
  });

  it('includes the single editor installed before the Hub when it is there, whose version its path doesn’t say', () => {
    expect(findUnityEditors(mac, fakeFileSystem(['/Applications/Unity/Unity.app']))).toEqual([{ version: '', folder: '/Applications/Unity/Unity.app' }]);
    expect(findUnityEditors(windows, fakeFileSystem(['C:\\Program Files\\Unity\\Editor\\Unity.exe']))).toEqual([{ version: '', folder: 'C:\\Program Files\\Unity\\Editor' }]);
    expect(findUnityEditors(mac, fakeFileSystem([]))).toEqual([]);
    expect(findUnityEditors(windows, fakeFileSystem([]))).toEqual([]);
  });
});
