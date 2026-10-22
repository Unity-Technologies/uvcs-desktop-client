import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linuxDesktopEntry } from './linuxDesktopEntry';
import { registerLinkScheme, type SchemeRegistrar } from './registerLinkScheme';

const HOME = join('/home', 'ana');
const ENTRY_PATH = join(HOME, '.local', 'share', 'applications', 'com.unity.uvcs-desktop.desktop');
const APP_IMAGE = '/home/ana/Apps/UnityVersionControl.AppImage';

/** An OS whose files are a map, recording what the app asked of it. */
function fakeOs(platform: NodeJS.Platform, env: NodeJS.ProcessEnv = {}, files: Record<string, string> = {}) {
  const registered: unknown[][] = [];
  const written = new Map<string, string>();
  const os: SchemeRegistrar = {
    platform,
    env,
    execPath: platform === 'win32' ? 'C:\\Users\\ana\\AppData\\Local\\Programs\\uvcs\\Unity Version Control.exe' : '/Applications/Unity Version Control.app/Contents/MacOS/Unity Version Control',
    homeDirectory: HOME,
    productName: 'Unity Version Control',
    readText: async (path) => written.get(path) ?? files[path] ?? null,
    writeText: async (path, text) => void written.set(path, text),
    setAsDefaultProtocolClient: (...args) => registered.push(args) > 0,
  };
  return { os, registered, written };
}

const APP_IMAGE_ENV = { APPIMAGE: APP_IMAGE, CHROME_DESKTOP: 'com.unity.uvcs-desktop.desktop' };

describe('registerLinkScheme', () => {
  it('registers on Windows the command the installer writes', async () => {
    const { os, registered } = fakeOs('win32');
    await registerLinkScheme(os);
    expect(registered).toEqual([['uvcs', os.execPath, ['--uvcs-link', '--']]]);
  });

  it('makes this copy of the app the handler on macOS, which Info.plist declares the scheme for', async () => {
    const { os, registered } = fakeOs('darwin');
    await registerLinkScheme(os);
    expect(registered).toEqual([['uvcs']]);
  });

  it("writes an AppImage's desktop entry and makes it the handler, once", async () => {
    const { os, registered, written } = fakeOs('linux', APP_IMAGE_ENV);
    await registerLinkScheme(os);
    expect(written.get(ENTRY_PATH)).toBe(linuxDesktopEntry(APP_IMAGE, 'Unity Version Control'));
    expect(registered).toEqual([['uvcs']]);

    // The next launch finds it as it is, and asks the desktop nothing.
    await registerLinkScheme(os);
    expect(registered).toHaveLength(1);
  });

  it('rewrites its entry when the AppImage moved, in the data folder the desktop names', async () => {
    const dataHome = join('/data', 'ana');
    const path = join(dataHome, 'applications', 'com.unity.uvcs-desktop.desktop');
    const { os, registered, written } = fakeOs('linux', { ...APP_IMAGE_ENV, XDG_DATA_HOME: dataHome }, { [path]: linuxDesktopEntry('/old/place.AppImage', 'Unity Version Control') });
    await registerLinkScheme(os);
    expect(written.get(path)).toContain(`Exec="${APP_IMAGE}"`);
    expect(registered).toHaveLength(1);
  });

  it("leaves an entry it didn't write alone", async () => {
    const theirs = '[Desktop Entry]\nExec=/opt/uvcs/uvcs-desktop %U\n';
    const { os, registered, written } = fakeOs('linux', APP_IMAGE_ENV, { [ENTRY_PATH]: theirs });
    await registerLinkScheme(os);
    expect(written.size).toBe(0);
    expect(registered).toEqual([]);
  });

  it('registers nothing on Linux outside an AppImage: a package declares the scheme itself', async () => {
    const { os, registered, written } = fakeOs('linux', { CHROME_DESKTOP: 'com.unity.uvcs-desktop.desktop' });
    await registerLinkScheme(os);
    expect(written.size).toBe(0);
    expect(registered).toEqual([]);
  });
});
