import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import type { OutgoingHttpHeaders } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppUpdater, Provider, type UpdateInfo } from 'electron-updater';
import type { AppAdapter } from 'electron-updater/out/AppAdapter';
import type { DownloadUpdateOptions } from 'electron-updater/out/AppUpdater';
import type { ProviderRuntimeOptions } from 'electron-updater/out/providers/Provider';
import { withoutStagingUserId } from './withoutStagingUserId';

const NEWER_RELEASE: UpdateInfo = { version: '1.1.0', files: [], path: '', sha512: '', releaseDate: '2026-10-13T00:00:00.000Z' };

/** The headers every check gave the provider, which it sends with each request to the releases feed. */
const providerHeaders: (OutgoingHttpHeaders | null)[] = [];

/** A releases feed answering with a newer release, recording the headers instead of sending them. */
class RecordingProvider extends Provider<UpdateInfo> {
  constructor(_options: unknown, _updater: unknown, runtimeOptions: ProviderRuntimeOptions) {
    super(runtimeOptions);
  }

  override setRequestHeaders(value: OutgoingHttpHeaders | null): void {
    providerHeaders.push(value);
    super.setRequestHeaders(value);
  }

  async getLatestVersion(): Promise<UpdateInfo> {
    return NEWER_RELEASE;
  }

  resolveFiles(): [] {
    return [];
  }
}

/**
 * electron-updater's real `AppUpdater` (the base of the platform updaters `autoUpdater` is one of), without Electron:
 * it reads the app through `AppAdapter`, and records what a download would send instead of downloading.
 */
class TestUpdater extends AppUpdater {
  readonly downloadHeaders: (OutgoingHttpHeaders | undefined)[] = [];

  constructor(app: AppAdapter) {
    super(null, app);
  }

  override async doDownloadUpdate(options: DownloadUpdateOptions): Promise<string[]> {
    this.downloadHeaders.push(options.requestHeaders);
    return [];
  }

  quitAndInstall(): void {}
}

function fakeApp(userDataPath: string): AppAdapter {
  return {
    version: '1.0.0',
    name: 'Unity Version Control',
    isPackaged: true,
    appUpdateConfigPath: join(userDataPath, 'app-update.yml'),
    userDataPath,
    baseCachePath: userDataPath,
    whenReady: async () => undefined,
    relaunch: () => undefined,
    quit: () => undefined,
    onQuit: () => undefined,
  };
}

async function updaterOverRecordingFeed(): Promise<{ updater: TestUpdater; userDataPath: string }> {
  providerHeaders.length = 0;
  const userDataPath = await mkdtemp(join(tmpdir(), 'updater-'));
  const updater = new TestUpdater(fakeApp(userDataPath));
  updater.logger = null;
  updater.autoDownload = false;
  updater.setFeedURL({ provider: 'custom', updateProvider: RecordingProvider });
  withoutStagingUserId(updater);
  return { updater, userDataPath };
}

function headerNames(headers: OutgoingHttpHeaders | null | undefined): string[] {
  return Object.keys(headers ?? {}).map((name) => name.toLowerCase());
}

describe('withoutStagingUserId', () => {
  it('checks for updates sending no staging user id to the releases feed', async () => {
    const { updater } = await updaterOverRecordingFeed();

    const result = await updater.checkForUpdates();

    expect(result?.isUpdateAvailable).toBe(true);
    expect(providerHeaders).not.toHaveLength(0);
    for (const headers of providerHeaders) expect(headerNames(headers)).not.toContain('x-user-staging-id');
  });

  it('keeps the headers the app sets itself', async () => {
    const { updater } = await updaterOverRecordingFeed();
    updater.requestHeaders = { 'x-app-header': 'kept' };

    await updater.checkForUpdates();

    expect(providerHeaders.at(-1)).toEqual({ 'x-app-header': 'kept' });
  });

  it('writes no staging user id file', async () => {
    const { updater, userDataPath } = await updaterOverRecordingFeed();

    await updater.checkForUpdates();
    await updater.downloadUpdate();

    expect(existsSync(join(userDataPath, '.updaterId'))).toBe(false);
  });

  it('downloads sending no staging user id', async () => {
    const { updater } = await updaterOverRecordingFeed();

    await updater.checkForUpdates();
    await updater.downloadUpdate();

    expect(updater.downloadHeaders).toHaveLength(1);
    expect(headerNames(updater.downloadHeaders[0])).not.toContain('x-user-staging-id');
  });

  it('offers a release that asks for a staged rollout to everyone', async () => {
    const { updater } = await updaterOverRecordingFeed();

    expect(await updater.isUserWithinRollout({ ...NEWER_RELEASE, stagingPercentage: 1 })).toBe(true);
  });
});
