import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workspacePathOf } from '@shared/domain/place';
import { memorySettings } from '../settings/testing/memorySettings';
import { fakeElectron } from '../window/testing/fakeElectron';
import { WorkspaceWindows } from '../window/WorkspaceWindows';
import { handleLaunchRequests, launchNamesAFolder } from './launchRequests';

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
    onRepositoryLeft: () => {},
    onWindowsChanged: () => {},
    cmSetup: () => null,
    onLastWindowClosing: () => {},
    onClosed: () => {},
    onCloseRequested: () => {},
    closeLeftBehind: () => {},
    repositoryGuids: { knownGuidOf: () => undefined, specNow: async (spec) => spec },
  });
  const lookups: { answer: Promise<string | null>; resolve: (root: string | null) => void }[] = [];
  const findRoot = (): Promise<string | null> => {
    let resolve: (root: string | null) => void = () => {};
    const answer = new Promise<string | null>((settle) => (resolve = settle));
    lookups.push({ answer, resolve });
    return answer;
  };
  /** `cm` answers the oldest lookup still waiting (asked once `cm` runs); settles once the app has acted on the answer. */
  const found = async (root: string | null): Promise<void> => {
    for (let turn = 0; turn < 5 && lookups.length === 0; turn++) await Promise.resolve();
    const lookup = lookups.shift()!;
    lookup.resolve(root);
    await lookup.answer;
    for (let turn = 0; turn < 5; turn++) await Promise.resolve();
  };
  const requestedIn = (index: number): string | null => {
    const place = windows.takeRequested(fakeElectron.windows()[index]!.webContents.id);
    return place && workspacePathOf(place);
  };
  return { windows, findRoot, found, requestedIn, lastUsed };
}

/** A `cm` that runs. */
const READY_CM = { isReady: () => true, whenReady: async () => undefined };

describe('handleLaunchRequests', () => {
  it('opens the first window at once while the app’s own cm is set up, and the folder’s workspace once it runs', async () => {
    const { windows, findRoot, found } = setUp();
    let cmReady!: () => void;
    const cm = { isReady: () => false, whenReady: () => new Promise<void>((resolve) => (cmReady = resolve)) };
    const launched = handleLaunchRequests(windows, findRoot, cm, { argv: ['uvcs', join(GAME, 'src')], workingDirectory: GAME });

    fakeElectron.app.ready = true;
    await launched;
    windows.openFirst();
    expect(fakeElectron.windows()).toHaveLength(1);
    cmReady();
    await found(GAME);
    // The first window opened on the last workspace used, before `cm` could find the folder's: it opens in its own.
    expect(windows.shownWorkspaces()).toContain(GAME);
  });

  it('opens the workspace the launch names in the first window, however long cm takes to find it', async () => {
    const { windows, findRoot, found, requestedIn } = setUp();
    const launched = handleLaunchRequests(windows, findRoot, READY_CM, { argv: ['uvcs', join(GAME, 'src')], workingDirectory: GAME });

    fakeElectron.app.ready = true;
    await found(GAME);
    await launched;
    windows.openFirst();
    expect(fakeElectron.windows()).toHaveLength(1);
    expect(requestedIn(0)).toBe(GAME);
  });

  it('opens the last workspace used when the launch names a folder outside any workspace', async () => {
    const { windows, findRoot, found, requestedIn, lastUsed } = setUp();
    const launched = handleLaunchRequests(windows, findRoot, READY_CM, { argv: ['uvcs', tmpdir()], workingDirectory: GAME });

    fakeElectron.app.ready = true;
    await found(null);
    await launched;
    windows.openFirst();
    expect(fakeElectron.windows()).toHaveLength(1);
    expect(requestedIn(0)).toBe(lastUsed);
  });

  it('opens the workspace a later launch names, and brings the app forward when it names none', async () => {
    const { windows, findRoot, found, requestedIn } = setUp();
    handleLaunchRequests(windows, findRoot, READY_CM, { argv: ['uvcs'], workingDirectory: GAME });
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

describe('launchNamesAFolder', () => {
  it('tells, as the app loads, whether the installed app was launched naming a folder (Windows, Linux)', () => {
    expect(launchNamesAFolder({ argv: ['uvcs', 'src'], workingDirectory: GAME })).toBe(true);
    expect(launchNamesAFolder({ argv: ['uvcs', '--some-switch'], workingDirectory: GAME })).toBe(false);
  });

  it('is never true in development builds, which open no folder they are named', () => {
    fakeElectron.app.isPackaged = false;
    expect(launchNamesAFolder({ argv: ['electron', '.'], workingDirectory: GAME })).toBe(false);
  });
});
