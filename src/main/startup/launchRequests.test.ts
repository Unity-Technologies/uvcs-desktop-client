import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memorySettings } from '../settings/testing/memorySettings';
import { fakeElectron } from '../window/testing/fakeElectron';
import { WorkspaceWindows } from '../window/WorkspaceWindows';
import { handleLaunchRequests } from './launchRequests';

vi.mock('electron', async () => (await import('../window/testing/fakeElectron')).fakeElectron.module);
vi.mock('../window/createMainWindow', async () => {
  const { fakeElectron } = await import('../window/testing/fakeElectron');
  return { createMainWindow: () => fakeElectron.newWindow() };
});

const GAME = join('/work', 'game');

beforeEach(() => fakeElectron.reset());

/** The installed app's windows, the last workspace used still on disk, and a `cm` that finds workspace roots when told. */
function setUp() {
  const lastUsed = mkdtempSync(join(tmpdir(), 'uvcs-last-'));
  const windows = new WorkspaceWindows({
    settings: memorySettings({ recentWorkspacePaths: [lastUsed] }),
    workspaceOf: () => undefined,
    onWindowsChanged: () => {},
    onLastWindowClosing: () => {},
    onClosed: () => {},
  });
  const lookups: { answer: Promise<string | null>; resolve: (root: string | null) => void }[] = [];
  const findRoot = (): Promise<string | null> => {
    let resolve: (root: string | null) => void = () => {};
    const answer = new Promise<string | null>((settle) => (resolve = settle));
    lookups.push({ answer, resolve });
    return answer;
  };
  /** `cm` answers the oldest lookup still waiting; settles once the app has acted on the answer. */
  const found = async (root: string | null): Promise<void> => {
    const lookup = lookups.shift()!;
    lookup.resolve(root);
    await lookup.answer;
  };
  const requestedIn = (index: number): string | null => windows.takeRequested(fakeElectron.windows()[index]!.webContents.id);
  return { windows, findRoot, found, requestedIn, lastUsed };
}

describe('handleLaunchRequests', () => {
  it('opens the workspace the launch names in the first window, however long cm takes to find it', async () => {
    const { windows, findRoot, found, requestedIn } = setUp();
    const launched = handleLaunchRequests(windows, findRoot, { argv: ['uvcs', join(GAME, 'src')], workingDirectory: GAME });

    fakeElectron.app.ready = true;
    await found(GAME);
    await launched;
    windows.openFirst();
    expect(fakeElectron.windows()).toHaveLength(1);
    expect(requestedIn(0)).toBe(GAME);
  });

  it('opens the last workspace used when the launch names a folder outside any workspace', async () => {
    const { windows, findRoot, found, requestedIn, lastUsed } = setUp();
    const launched = handleLaunchRequests(windows, findRoot, { argv: ['uvcs', tmpdir()], workingDirectory: GAME });

    fakeElectron.app.ready = true;
    await found(null);
    await launched;
    windows.openFirst();
    expect(fakeElectron.windows()).toHaveLength(1);
    expect(requestedIn(0)).toBe(lastUsed);
  });

  it('opens the workspace a later launch names, and brings the app forward when it names none', async () => {
    const { windows, findRoot, found, requestedIn } = setUp();
    handleLaunchRequests(windows, findRoot, { argv: ['uvcs'], workingDirectory: GAME });
    fakeElectron.app.ready = true;
    windows.openFirst();
    requestedIn(0);
    fakeElectron.windows()[0]!.minimize();

    fakeElectron.app.emit('second-instance', {}, ['uvcs'], GAME);
    expect(fakeElectron.focused()).toBe(fakeElectron.windows()[0]);

    fakeElectron.app.emit('second-instance', {}, ['uvcs', 'src'], GAME);
    await found(GAME);
    expect(fakeElectron.windows()).toHaveLength(1);
    expect(requestedIn(0)).toBe(GAME);
  });
});
