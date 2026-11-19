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
/** The installed `cm` the tests find: newer than the pinned one, so it may run. */
const INSTALLED_VERSION = '11.0.16.10700';

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
  const pruned: string[] = [];
  const revealed: string[] = [];
  const runtime = new CmRuntime({
    pin: PIN,
    platform: 'linux',
    arch: 'x64',
    environmentPath: undefined,
    installer,
    choice: () => choice,
    saveChoice: (saved) => (choice = saved),
    findInstalled: () => '/usr/bin/cm',
    versionOf: async () => `${INSTALLED_VERSION}\n`,
    relocated: () => relocations++,
    statusChanged: (status) => statuses.push(status),
    prune: (pinned) => pruned.push(pinned),
    reveal: (path) => revealed.push(path),
    timers: { now: () => now, setTimeout: (run, ms) => timers.push({ ms, run }), clearTimeout: () => timers.splice(0) },
    ...overrides,
  });
  return { runtime, installer, statuses, timers, pruned, revealed, advance: (ms: number) => (now += ms), relocations: () => relocations, choice: () => choice };
}

describe('CmRuntime', () => {
  it('is ready at once when the pinned version is there', () => {
    const { runtime, installer } = runtimeWith({ installed: [VERSION] });
    runtime.start();
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'managed' });
    expect(runtime.setupRunning()).toBeNull();
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(installer.installs).toBe(0);
  });

  it('sets up the pinned version on the first run, then runs it', async () => {
    const { runtime, installer, statuses, relocations } = runtimeWith();
    runtime.start();
    expect(runtime.isReady()).toBe(false);
    expect(runtime.status()).toMatchObject({ kind: 'installing', phase: 'downloading', receivedBytes: 0, totalBytes: null, firstRun: true });
    expect(runtime.setupRunning()).toBe('settingUp');
    await installer.succeed();
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'managed' });
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed' });
    expect(relocations()).toBe(1);
  });

  it('says it updates, not sets up, when an older version is kept', () => {
    const { runtime } = runtimeWith({ installed: ['11.0.16.9000'] });
    runtime.start();
    expect(runtime.status()).toMatchObject({ kind: 'installing', firstRun: false });
    expect(runtime.setupRunning()).toBe('updating');
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
      installedCm: { path: '/usr/bin/cm', version: INSTALLED_VERSION },
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
    await runtime.use('installed');
    expect(choice()).toBe('installed');
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
    expect(relocations()).toBe(1);
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
    expect(runtime.hasOwnCm()).toBe(false);
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'installed' });
    expect(installer.installs).toBe(0);
  });
});

describe('CmRuntime with an update waiting', () => {
  const NEXT: CmVersionPin = { ...PIN, version: '11.0.16.10700' };

  it('downloads the cm the update pins, reporting how far it is', async () => {
    const { runtime, installer } = runtimeWith({ installed: [VERSION] });
    const prefetch = runtime.prefetchFor(NEXT);
    const fractions: number[] = [];
    const downloading = prefetch!.download((fraction) => fractions.push(fraction));
    installer.progress({ phase: 'downloading', receivedBytes: 25, totalBytes: 100 });
    installer.progress({ phase: 'finishing' });
    await installer.succeed();
    await downloading;
    expect(fractions).toEqual([0.25, 1]);
  });

  it('downloads nothing for the same version, nor when the installed one runs', () => {
    expect(runtimeWith({ installed: [VERSION] }).runtime.prefetchFor(PIN)).toBeNull();
    expect(runtimeWith({ chosen: 'installed' }).runtime.prefetchFor(NEXT)).toBeNull();
  });

  it('downloads nothing where the platform has no bundle', () => {
    expect(runtimeWith({ arch: 'arm64' }).runtime.prefetchFor(NEXT)).toBeNull();
  });
});

describe('CmRuntime pruning the store', () => {
  it('prunes once a launch, as soon as a cm runs', async () => {
    const ready = runtimeWith({ installed: [VERSION] });
    ready.runtime.start();
    ready.runtime.use('managed');
    expect(ready.pruned).toEqual([VERSION]);

    const settingUp = runtimeWith();
    settingUp.runtime.start();
    expect(settingUp.pruned).toEqual([]);
    await settingUp.installer.succeed();
    expect(settingUp.pruned).toEqual([VERSION]);
  });
});

describe('CmRuntime and what waits for cm', () => {
  it('lets a launch’s folder lookup wait until the app’s own cm is set up', async () => {
    const { runtime, installer } = runtimeWith();
    runtime.start();
    let ready = false;
    void runtime.whenReady().then(() => (ready = true));
    await flush();
    expect(ready).toBe(false);
    await installer.succeed();
    expect(ready).toBe(true);
  });

  it('answers at once when cm runs', async () => {
    await expect(runtimeWith({ installed: [VERSION] }).runtime.whenReady()).resolves.toBeUndefined();
  });
});

describe('CmRuntime going back to its own cm from the installed one', () => {
  it('keeps the installed one running while its own downloads, then switches to it', async () => {
    const { runtime, installer, statuses, relocations, choice } = runtimeWith({ chosen: 'installed' });
    runtime.start();
    await runtime.use('managed');
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed', switchingToOwn: { kind: 'downloading', fraction: null } });
    installer.progress({ phase: 'downloading', receivedBytes: 40, totalBytes: 100 });
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed', switchingToOwn: { kind: 'downloading', fraction: 0.4 } });
    expect(choice()).toBe('installed');

    await installer.succeed();
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed' });
    expect(choice()).toBe('managed');
    expect(relocations()).toBe(1);
  });

  it('stays on the installed one when it’s chosen again while its own downloads', async () => {
    const { runtime, installer, statuses, relocations, choice } = runtimeWith({ chosen: 'installed' });
    await runtime.use('managed');
    await runtime.use('installed');
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
    await installer.succeed();
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(choice()).toBe('installed');
    expect(relocations()).toBe(0);
  });

  it('stays on the installed one, saying why, when its own fails to download', async () => {
    const { runtime, installer, statuses, relocations, choice } = runtimeWith({ chosen: 'installed' });
    await runtime.use('managed');
    await installer.fail(new CmInstallError('unavailable', 'HTTP 403'));
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed', switchingToOwn: { kind: 'failed', failure: 'unavailable', detail: 'HTTP 403' } });
    expect(choice()).toBe('installed');
    expect(relocations()).toBe(0);
  });
});

describe('CmRuntime with choices made during its setup', () => {
  it('keeps the installed one chosen while its own was downloading, once that finishes', async () => {
    const { runtime, installer, statuses, relocations } = runtimeWith();
    runtime.start();
    await runtime.use('installed');
    await installer.succeed();
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
    expect(relocations()).toBe(1);
  });

  it('says nothing of a failure of its own once the installed one runs', async () => {
    const { runtime, installer, statuses, timers } = runtimeWith();
    runtime.start();
    await runtime.use('installed');
    await installer.fail(new Error('net::ERR_INTERNET_DISCONNECTED'));
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
    expect(timers).toEqual([]);
  });

  it('starts no second download when retried, or its own chosen again, while one runs', async () => {
    const { runtime, installer } = runtimeWith();
    runtime.start();
    runtime.retry();
    await runtime.use('managed');
    expect(installer.installs).toBe(1);
  });
});

describe('CmRuntime refusing an installed cm older than its own', () => {
  const OLDER = '11.0.16.9000';

  it('never runs an older installed one when it’s chosen', async () => {
    const { runtime, statuses, choice, relocations } = runtimeWith({ installed: [VERSION], versionOf: async () => `${OLDER}\n` });
    runtime.start();
    await runtime.use('installed');
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(choice()).toBe('managed');
    expect(statuses).toEqual([]);
    expect(relocations()).toBe(0);
  });

  it('offers no older installed one when its own fails to set up', async () => {
    const { runtime, installer } = runtimeWith({ versionOf: async () => OLDER });
    runtime.start();
    await installer.fail(new Error('net::ERR_INTERNET_DISCONNECTED'));
    expect(runtime.status()).toMatchObject({ kind: 'failed', installedCm: null });
  });

  it('admits its own, the environment’s and an installed one as new as its own or newer', () => {
    expect(runtimeWith({ installed: [VERSION] }).runtime.admits(MANAGED, '11.0.16.1')).toBe(true);
    expect(runtimeWith({ environmentPath: '/fake/cm' }).runtime.admits('/fake/cm', '1.0.0.0')).toBe(true);
    expect(runtimeWith({ chosen: 'installed' }).runtime.admits('/usr/bin/cm', VERSION)).toBe(true);
    expect(runtimeWith({ chosen: 'installed' }).runtime.admits('/usr/bin/cm', INSTALLED_VERSION)).toBe(true);
  });

  it('runs its own instead of an older installed one chosen before, and saves that', () => {
    const { runtime, statuses, choice, relocations } = runtimeWith({ chosen: 'installed', installed: [VERSION] });
    runtime.start();
    expect(runtime.admits('/usr/bin/cm', OLDER)).toBe(false);
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(choice()).toBe('managed');
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed' });
    expect(relocations()).toBe(1);
  });

  it('sets its own up first when it isn’t there yet', async () => {
    const { runtime, installer, statuses } = runtimeWith({ chosen: 'installed' });
    runtime.start();
    expect(runtime.admits('/usr/bin/cm', OLDER)).toBe(false);
    expect(runtime.isReady()).toBe(false);
    expect(statuses.at(-1)).toMatchObject({ kind: 'installing', firstRun: true });
    await installer.succeed();
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed' });
  });

  it('runs nothing where it has no cm of its own (Linux on Arm)', () => {
    const { runtime, choice } = runtimeWith({ arch: 'arm64' });
    runtime.start();
    expect(runtime.admits('/usr/bin/cm', OLDER)).toBe(false);
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(choice()).toBe('managed');
  });

  it('answers only for the cm running: another one asked before a switch is none of its business', () => {
    const { runtime } = runtimeWith({ chosen: 'installed' });
    expect(runtime.admits('/somewhere/else/cm', OLDER)).toBe(true);
  });
});

describe('CmRuntime showing its cm', () => {
  it('shows the cm that runs, and nothing for one known only by its bare name', () => {
    const real = runtimeWith({ environmentPath: process.execPath });
    real.runtime.revealCm();
    expect(real.revealed).toEqual([process.execPath]);

    const missing = runtimeWith({ arch: 'arm64', findInstalled: () => null });
    missing.runtime.revealCm();
    expect(missing.revealed).toEqual([]);
  });
});
