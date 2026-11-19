import { describe, expect, it } from 'vitest';
import type { CmChoice, CmRuntimeStatus } from '@shared/domain/cmRuntime';
import type { CmVersionPin } from './cmBundles';
import { CmInstallError } from './cmInstallFailure';
import type { CmInstallProgress } from './CmInstaller';
import { CmRuntime, PROGRESS_INTERVAL_MS, type CmRuntimeOptions } from './CmRuntime';

const VERSION = '11.0.16.10659';
const PIN: CmVersionPin = {
  version: VERSION,
  bundles: {
    'win32-x64': { file: 'client-windows.zip', sha256: 'a'.repeat(64) },
    'darwin-x64': { file: 'client-macos.tar.gz', sha256: 'b'.repeat(64) },
    'darwin-arm64': { file: 'client-macos-arm64.tar.gz', sha256: 'c'.repeat(64) },
    'linux-x64': { file: 'client-linux.tar.gz', sha256: 'd'.repeat(64) },
  },
};
const MANAGED = `/store/${VERSION}/client/cm`;

/** An installer whose installs the test settles, one at a time, reporting progress as it wishes. */
function fakeInstaller(installed: string[] = []) {
  let settle: { resolve: () => void; reject: (error: Error) => void; progress: (step: CmInstallProgress) => void } | null = null;
  const installer = {
    installs: 0,
    cmPathOf: (version: string) => `/store/${version}/client/cm`,
    isInstalled: (version: string) => installed.includes(version),
    hasAnyVersion: () => installed.length > 0,
    install: (version: string, _bundle: unknown, onProgress: (step: CmInstallProgress) => void) => {
      installer.installs++;
      return new Promise<string>((resolve, reject) => {
        settle = {
          resolve: () => {
            installed.push(version);
            resolve(`/store/${version}/client/cm`);
          },
          reject,
          progress: onProgress,
        };
      });
    },
    progress: (step: CmInstallProgress) => settle!.progress(step),
    succeed: async () => {
      settle!.resolve();
      await flush();
    },
    fail: async (error: Error) => {
      settle!.reject(error);
      await flush();
    },
  };
  return installer;
}

async function flush(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

function runtimeWith(setup: Partial<CmRuntimeOptions> & { installed?: string[]; chosen?: CmChoice } = {}) {
  const { installed, chosen, ...overrides } = setup;
  const installer = fakeInstaller(installed);
  const statuses: CmRuntimeStatus[] = [];
  const timers: { ms: number; run: () => void }[] = [];
  let now = 0;
  let choice: CmChoice = chosen ?? 'managed';
  let relocations = 0;
  const runtime = new CmRuntime({
    pin: PIN,
    platform: 'linux',
    arch: 'x64',
    environmentPath: undefined,
    installer,
    choice: () => choice,
    saveChoice: (saved) => (choice = saved),
    findInstalled: () => '/usr/bin/cm',
    versionOf: async () => '11.0.16.9000\n',
    relocated: () => relocations++,
    statusChanged: (status) => statuses.push(status),
    timers: { now: () => now, setTimeout: (run, ms) => timers.push({ ms, run }), clearTimeout: () => timers.splice(0) },
    ...overrides,
  });
  return { runtime, installer, statuses, timers, advance: (ms: number) => (now += ms), relocations: () => relocations, choice: () => choice };
}

describe('CmRuntime', () => {
  it('is ready at once when the pinned version is there', () => {
    const { runtime, installer } = runtimeWith({ installed: [VERSION] });
    runtime.start();
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'managed' });
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(installer.installs).toBe(0);
  });

  it('sets up the pinned version on the first run, then runs it', async () => {
    const { runtime, installer, statuses, relocations } = runtimeWith();
    runtime.start();
    expect(runtime.isReady()).toBe(false);
    expect(runtime.status()).toMatchObject({ kind: 'installing', phase: 'downloading', receivedBytes: 0, totalBytes: null, firstRun: true });
    await installer.succeed();
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'managed' });
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed' });
    expect(relocations()).toBe(1);
  });

  it('says it updates, not sets up, when an older version is kept', () => {
    const { runtime } = runtimeWith({ installed: ['11.0.16.9000'] });
    runtime.start();
    expect(runtime.status()).toMatchObject({ kind: 'installing', firstRun: false });
  });

  it('sends a download’s progress at most every interval, and every change of phase', () => {
    const { runtime, installer, statuses, advance } = runtimeWith();
    runtime.start();
    installer.progress({ phase: 'downloading', receivedBytes: 10, totalBytes: 100 });
    installer.progress({ phase: 'downloading', receivedBytes: 20, totalBytes: 100 });
    advance(PROGRESS_INTERVAL_MS);
    installer.progress({ phase: 'downloading', receivedBytes: 30, totalBytes: 100 });
    installer.progress({ phase: 'finishing' });
    expect(statuses.map((status) => (status.kind === 'installing' ? `${status.phase} ${status.receivedBytes}/${status.totalBytes}` : status.kind))).toEqual([
      'downloading 0/null',
      'downloading 30/100',
      'finishing 100/100',
    ]);
  });

  it('fails with the installed cm to offer, and retries by itself while offline', async () => {
    const { runtime, installer, statuses, timers } = runtimeWith();
    runtime.start();
    await installer.fail(new Error('net::ERR_INTERNET_DISCONNECTED'));
    expect(statuses.at(-1)).toEqual({
      kind: 'failed',
      version: VERSION,
      failure: 'offline',
      detail: 'net::ERR_INTERNET_DISCONNECTED',
      firstRun: true,
      installedCm: { path: '/usr/bin/cm', version: '11.0.16.9000' },
    });
    expect(timers.map((timer) => timer.ms)).toEqual([5_000]);
    timers[0]!.run();
    expect(installer.installs).toBe(2);
  });

  it('waits for the user on a failure the network won’t fix', async () => {
    const { runtime, installer, timers } = runtimeWith();
    runtime.start();
    await installer.fail(new CmInstallError('diskFull', 'No space left on device'));
    expect(runtime.status()).toMatchObject({ kind: 'failed', failure: 'diskFull' });
    expect(timers).toEqual([]);
    runtime.retry();
    expect(installer.installs).toBe(2);
  });

  it('offers no installed cm when none is found', async () => {
    const { runtime, installer } = runtimeWith({ findInstalled: () => null });
    runtime.start();
    await installer.fail(new CmInstallError('unavailable', 'HTTP 403'));
    expect(runtime.status()).toMatchObject({ kind: 'failed', installedCm: null });
  });

  it('runs the installed cm once the user chooses it, and saves the choice', async () => {
    const { runtime, installer, statuses, relocations, choice } = runtimeWith();
    runtime.start();
    await installer.fail(new CmInstallError('unavailable', 'HTTP 403'));
    runtime.use('installed');
    expect(choice()).toBe('installed');
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
    expect(relocations()).toBe(1);
  });

  it('sets up the app’s own when the user goes back to it from the installed one', () => {
    const { runtime, installer } = runtimeWith({ chosen: 'installed' });
    runtime.start();
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'installed' });
    runtime.use('managed');
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(installer.installs).toBe(1);
  });

  it('runs UVCS_CM_PATH without setting up anything', () => {
    const { runtime, installer } = runtimeWith({ environmentPath: '/fake/cm' });
    runtime.start();
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'environment' });
    expect(installer.installs).toBe(0);
  });

  it('runs the installed cm where the platform has no bundle', () => {
    const { runtime, installer } = runtimeWith({ arch: 'arm64' });
    runtime.start();
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'installed' });
    expect(installer.installs).toBe(0);
  });
});
