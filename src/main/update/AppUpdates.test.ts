import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UpdateStatus } from '@shared/domain/appUpdate';
import { AppUpdates, CHECK_INTERVAL_MS, FIRST_CHECK_DELAY_MS, type AppUpdatesDependencies, type UpdateFeed } from './AppUpdates';
import type { ReleaseFile } from './installerAsset';

const files: ReleaseFile[] = [
  { url: 'UnityVersionControl-1.2.0-macOS-arm64.zip', sha512: 'z' },
  { url: 'UnityVersionControl-1.2.0-macOS-arm64.dmg', sha512: 'd' },
];
const found = { isUpdateAvailable: true, updateInfo: { version: '1.2.0', files } };
const notFound = { isUpdateAvailable: false, updateInfo: { version: '1.1.0', files: [] } };

/** A feed answering each check with `answers` in turn, whose downloads report `progress` and then finish. */
function fakeFeed(answers: Array<Awaited<ReturnType<UpdateFeed['checkForUpdates']>> | Error>, progress: number[] = []) {
  let onProgress: (progress: { percent: number }) => void = () => undefined;
  const feed = {
    checkForUpdates: vi.fn(async () => {
      const answer = answers.shift();
      if (answer instanceof Error) throw answer;
      return answer ?? null;
    }),
    downloadUpdate: vi.fn(async () => {
      for (const percent of progress) onProgress({ percent });
      return [];
    }),
    quitAndInstall: vi.fn(),
    on: (_event: 'download-progress', listener: typeof onProgress) => (onProgress = listener),
  };
  return feed;
}

function updates(feed: ReturnType<typeof fakeFeed>, parts: Partial<AppUpdatesDependencies> = {}) {
  const pushed: UpdateStatus[] = [];
  const dependencies: AppUpdatesDependencies = {
    feed,
    packaged: true,
    needsManualInstall: vi.fn(async () => false),
    downloadInstaller: vi.fn(async (_file, _version, onProgress) => {
      onProgress(40);
      onProgress(100);
      return '/Users/ana/Downloads/UnityVersionControl-1.2.0-macOS-arm64.dmg';
    }),
    installerOf: (releaseFiles) => releaseFiles.find((file) => file.url.endsWith('.dmg')) ?? null,
    openInstaller: vi.fn(async () => undefined),
    push: (status) => pushed.push(status),
    ...parts,
  };
  return { updates: new AppUpdates(dependencies), pushed, dependencies };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('checking for updates', () => {
  it('says the app is up to date when there is no newer release', async () => {
    const { updates: app, pushed } = updates(fakeFeed([notFound]));

    await app.check();

    expect(pushed).toEqual([{ state: 'checking' }, { state: 'upToDate' }]);
    expect(app.status()).toEqual({ state: 'upToDate' });
  });

  it('downloads the update found, in whole percents, then waits to restart into it', async () => {
    const feed = fakeFeed([found], [10.2, 10.7, 55.5, 100]);
    const { updates: app, pushed } = updates(feed);

    await app.check();

    expect(feed.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(pushed).toEqual([
      { state: 'checking' },
      { state: 'downloading', version: '1.2.0', percent: 0 },
      { state: 'downloading', version: '1.2.0', percent: 10 },
      { state: 'downloading', version: '1.2.0', percent: 55 },
      { state: 'downloading', version: '1.2.0', percent: 100 },
      { state: 'ready', version: '1.2.0', install: 'restart' },
    ]);
  });

  it('reports a failure in words the user can read', async () => {
    const offline = Object.assign(new Error('getaddrinfo ENOTFOUND github.com'), { code: 'ENOTFOUND' });
    const { updates: app } = updates(fakeFeed([offline]));

    await app.check();

    expect(app.status()).toEqual({ state: 'failed', error: "Couldn't reach the update server. Check your connection and try again." });
  });

  it('checks again after a failure', async () => {
    const { updates: app } = updates(fakeFeed([new Error('boom'), notFound]));

    await app.check();
    await app.check();

    expect(app.status()).toEqual({ state: 'upToDate' });
  });

  it('leaves a download under way or finished alone, and says where it stands to the window that asked', async () => {
    const feed = fakeFeed([found]);
    const { updates: app, pushed } = updates(feed);
    await app.check();
    pushed.length = 0;

    await app.check();

    expect(feed.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(pushed).toEqual([{ state: 'ready', version: '1.2.0', install: 'restart' }]);
  });

  it('never checks in a development build, and says so when asked', async () => {
    const feed = fakeFeed([found]);
    const { updates: app, pushed } = updates(feed, { packaged: false });

    await app.check();

    expect(feed.checkForUpdates).not.toHaveBeenCalled();
    expect(pushed).toEqual([{ state: 'unavailable' }]);
  });
});

describe('the checks on their own', () => {
  it('checks shortly after launch and then every hour', async () => {
    vi.useFakeTimers();
    const feed = fakeFeed([notFound, notFound, notFound]);
    const { updates: app } = updates(feed);

    app.checkPeriodically();
    await vi.advanceTimersByTimeAsync(FIRST_CHECK_DELAY_MS - 1);
    expect(feed.checkForUpdates).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(feed.checkForUpdates).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2 * CHECK_INTERVAL_MS);
    expect(feed.checkForUpdates).toHaveBeenCalledTimes(3);
  });

  it('are none in a development build', async () => {
    vi.useFakeTimers();
    const feed = fakeFeed([]);
    updates(feed, { packaged: false }).updates.checkPeriodically();

    await vi.advanceTimersByTimeAsync(2 * CHECK_INTERVAL_MS);

    expect(feed.checkForUpdates).not.toHaveBeenCalled();
  });
});

describe('a macOS build without a Developer ID signature', () => {
  const unsigned = { needsManualInstall: vi.fn(async () => true) };

  it("downloads the release's disk image itself instead of electron-updater's download, which Squirrel.Mac would reject", async () => {
    const feed = fakeFeed([found]);
    const { updates: app, pushed, dependencies } = updates(feed, unsigned);

    await app.check();

    expect(feed.downloadUpdate).not.toHaveBeenCalled();
    expect(dependencies.downloadInstaller).toHaveBeenCalledWith(files[1], '1.2.0', expect.any(Function));
    expect(pushed.slice(1)).toEqual([
      { state: 'downloading', version: '1.2.0', percent: 0 },
      { state: 'downloading', version: '1.2.0', percent: 40 },
      { state: 'downloading', version: '1.2.0', percent: 100 },
      { state: 'ready', version: '1.2.0', install: 'installer' },
    ]);
  });

  it('opens the downloaded disk image to install it', async () => {
    const feed = fakeFeed([found]);
    const { updates: app, dependencies } = updates(feed, unsigned);
    await app.check();

    await app.install();

    expect(dependencies.openInstaller).toHaveBeenCalledWith('/Users/ana/Downloads/UnityVersionControl-1.2.0-macOS-arm64.dmg');
    expect(feed.quitAndInstall).not.toHaveBeenCalled();
  });

  it('fails when the release has no disk image for this Mac', async () => {
    const { updates: app } = updates(fakeFeed([found]), { ...unsigned, installerOf: () => null });

    await app.check();

    expect(app.status()).toEqual({ state: 'failed', error: 'Version 1.2.0 has no installer for this Mac.' });
  });

  it('asks codesign only once an update is found, and once', async () => {
    const needsManualInstall = vi.fn(async () => true);
    const { updates: app } = updates(fakeFeed([notFound, found]), { needsManualInstall });

    await app.check();
    expect(needsManualInstall).not.toHaveBeenCalled();
    await app.check();
    expect(needsManualInstall).toHaveBeenCalledTimes(1);
  });
});

describe('installing', () => {
  it('restarts into the downloaded update, its Windows installer running silently', async () => {
    const feed = fakeFeed([found]);
    const { updates: app } = updates(feed);
    await app.check();

    await app.install();

    expect(feed.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('does nothing while no update is ready', async () => {
    const feed = fakeFeed([notFound]);
    const { updates: app } = updates(feed);
    await app.check();

    await app.install();

    expect(feed.quitAndInstall).not.toHaveBeenCalled();
  });
});
