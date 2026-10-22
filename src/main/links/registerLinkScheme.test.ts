import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linuxDesktopEntry } from './linuxDesktopEntry';
import { registerLinkScheme, type SchemeRegistrar } from './registerLinkScheme';

const HOME = join('/home', 'ana');
const APPLICATIONS = join(HOME, '.local', 'share', 'applications');
const ENTRY_PATH = join(APPLICATIONS, 'com.unity.uvcs-desktop.link-handler.desktop');
const APP_ENTRY_PATH = join(APPLICATIONS, 'com.unity.uvcs-desktop.desktop');
const APP_IMAGE = '/home/ana/Apps/UnityVersionControl.AppImage';

/** An OS whose files are a map, recording what the app asked of it. */
function fakeOs(platform: NodeJS.Platform, env: NodeJS.ProcessEnv = {}, files: Record<string, string> = {}) {
  const registered: unknown[][] = [];
  const handlers: string[] = [];
  const removed: string[] = [];
  const written = new Map<string, string>();
  const os: SchemeRegistrar = {
    platform,
    env,
    execPath: platform === 'win32' ? 'C:\\Users\\ana\\AppData\\Local\\Programs\\uvcs\\Unity Version Control.exe' : '/Applications/Unity Version Control.app/Contents/MacOS/Unity Version Control',
    homeDirectory: HOME,
    productName: 'Unity Version Control',
    readText: async (path) => (removed.includes(path) ? null : (written.get(path) ?? files[path] ?? null)),
    writeText: async (path, text) => void written.set(path, text),
    removeFile: async (path) => void removed.push(path),
    setAsDefaultProtocolClient: (...args) => registered.push(args) > 0,
    setDefaultLinkHandler: async (desktopId) => void handlers.push(desktopId),
  };
  return { os, registered, handlers, removed, written };
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

  it("writes an AppImage's link handler entry under an id of its own and makes it the handler, once", async () => {
    const { os, registered, handlers, written } = fakeOs('linux', APP_IMAGE_ENV);
    await registerLinkScheme(os);
    expect(written.get(ENTRY_PATH)).toBe(linuxDesktopEntry(APP_IMAGE, 'Unity Version Control'));
    // The launcher matches the app's windows by the app's own id: an entry under it would take their icon.
    expect([...written.keys()]).toEqual([ENTRY_PATH]);
    expect(handlers).toEqual(['com.unity.uvcs-desktop.link-handler.desktop']);
    expect(registered).toEqual([]);

    // The next launch finds it as it is, and asks the desktop nothing.
    await registerLinkScheme(os);
    expect(handlers).toHaveLength(1);
  });

  it("tries again at the next launch when the desktop couldn't make it the handler (xdg-utils missing)", async () => {
    const { os, handlers } = fakeOs('linux', APP_IMAGE_ENV);
    const failing: SchemeRegistrar = { ...os, setDefaultLinkHandler: async () => Promise.reject(new Error('xdg-mime: not found')) };
    await expect(registerLinkScheme(failing)).rejects.toThrow('xdg-mime');

    await registerLinkScheme(os);
    expect(handlers).toEqual(['com.unity.uvcs-desktop.link-handler.desktop']);
  });

  it("removes the entry an earlier version wrote under the app's own id, never another tool's", async () => {
    const ours = fakeOs('linux', APP_IMAGE_ENV, { [APP_ENTRY_PATH]: linuxDesktopEntry(APP_IMAGE, 'Unity Version Control') });
    await registerLinkScheme(ours.os);
    expect(ours.removed).toEqual([APP_ENTRY_PATH]);

    const theirs = fakeOs('linux', APP_IMAGE_ENV, { [APP_ENTRY_PATH]: '[Desktop Entry]\nIcon=uvcs\nExec=/home/ana/Apps/UnityVersionControl.AppImage\n' });
    await registerLinkScheme(theirs.os);
    expect(theirs.removed).toEqual([]);
  });

  it('rewrites its entry when the AppImage moved, in the data folder the desktop names', async () => {
    const dataHome = join('/data', 'ana');
    const path = join(dataHome, 'applications', 'com.unity.uvcs-desktop.link-handler.desktop');
    const { os, handlers, written } = fakeOs('linux', { ...APP_IMAGE_ENV, XDG_DATA_HOME: dataHome }, { [path]: linuxDesktopEntry('/old/place.AppImage', 'Unity Version Control') });
    await registerLinkScheme(os);
    expect(written.get(path)).toContain(`Exec="${APP_IMAGE}"`);
    expect(handlers).toHaveLength(1);
  });

  it("leaves an entry it didn't write alone", async () => {
    const theirs = '[Desktop Entry]\nExec=/opt/uvcs/uvcs-desktop %U\n';
    const { os, handlers, written } = fakeOs('linux', APP_IMAGE_ENV, { [ENTRY_PATH]: theirs });
    await registerLinkScheme(os);
    expect(written.size).toBe(0);
    expect(handlers).toEqual([]);
  });

  it('registers nothing on Linux outside an AppImage: a package declares the scheme itself', async () => {
    const { os, registered, handlers, written } = fakeOs('linux', { CHROME_DESKTOP: 'com.unity.uvcs-desktop.desktop' });
    await registerLinkScheme(os);
    expect(written.size).toBe(0);
    expect([...registered, ...handlers]).toEqual([]);
  });
});
