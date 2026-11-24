import { describe, expect, it } from 'vitest';
import type { CmChoice, CmRuntimeStatus, InstalledCm } from '@shared/domain/cmRuntime';
import type { OfficialUpdate } from '@shared/domain/officialUpdate';
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

/** The official installer's update, which the test settles: it updates the installed one or doesn't. */
function fakeOfficialUpdate() {
  let state: OfficialUpdate | null = null;
  const official = {
    prepared: [] as InstalledCm[],
    /** How many times the update was dropped, nothing needing it (`discard`). */
    discards: 0,
    discard: async () => void official.discards++,
    installs: [] as InstalledCm[],
    /** What the next install does to the installed one's version, and its result. */
    outcome: { updatesTo: null as string | null },
    onChange: () => undefined as void,
    state: () => state,
    set: (next: OfficialUpdate | null) => {
      state = next;
      official.onChange();
    },
    /** How the installed one updates on the computer the test plays. */
    by: 'installer' as 'installer' | 'command' | null,
    updatesBy: () => official.by,
    /** What `downloadAhead` was asked: the installed one and the floor. */
    downloadsAhead: [] as { installed: InstalledCm; floor: string }[],
    prepare: async (installed: InstalledCm) => void official.prepared.push(installed),
    downloadAhead: async (installed: InstalledCm, floor: string, onProgress: (fraction: number) => void) => {
      official.downloadsAhead.push({ installed, floor });
      onProgress(1);
    },
    install: async (installed: InstalledCm, _floor?: string) => {
      official.installs.push(installed);
      return official.outcome.updatesTo !== null;
    },
  };
  return official;
}

async function flush(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

function runtimeWith(setup: Partial<CmRuntimeOptions> & { installed?: string[]; chosen?: CmChoice; declinedFor?: string } = {}) {
  const { installed, chosen, declinedFor, ...overrides } = setup;
  const installer = fakeInstaller(installed);
  const statuses: CmRuntimeStatus[] = [];
  const timers: { ms: number; run: () => void }[] = [];
  let now = 0;
  let choice: CmChoice = chosen ?? 'managed';
  let relocations = 0;
  /** Relocations that said the `cm` at the same path was replaced, so its shells start again (`CmClient.relocate`). */
  let replacements = 0;
  let declined: string | null = declinedFor ?? null;
  const pruned: (string | null)[] = [];
  const revealed: string[] = [];
  const officialUpdate = fakeOfficialUpdate();
  const runtime: CmRuntime = new CmRuntime({
    pin: PIN,
    platform: 'linux',
    arch: 'x64',
    environmentPath: undefined,
    installer,
    choice: () => choice,
    saveChoice: (saved) => (choice = saved),
    declinedUpdateFor: () => declined,
    saveDeclinedUpdate: (pinned) => (declined = pinned),
    findInstalled: () => '/usr/bin/cm',
    versionOf: async () => `${INSTALLED_VERSION}\n`,
    relocated: ({ replaced }) => {
      relocations++;
      if (replaced) replacements++;
    },
    statusChanged: (status) => statuses.push(status),
    prune: (pinned) => pruned.push(pinned),
    reveal: (path) => revealed.push(path),
    timers: { now: () => now, setTimeout: (run, ms) => timers.push({ ms, run }), clearTimeout: () => timers.splice(0) },
    officialUpdate,
    ...overrides,
  });
  officialUpdate.onChange = () => runtime.officialUpdateChanged();
  return { officialUpdate, runtime, installer, statuses, timers, pruned, revealed, advance: (ms: number) => (now += ms), relocations: () => relocations, replacements: () => replacements, choice: () => choice, declined: () => declined };
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
    const prefetch = await runtime.prefetchFor(NEXT);
    expect(prefetch?.kind).toBe('own');
    const fractions: number[] = [];
    const downloading = prefetch!.kind === 'own' ? prefetch!.download((fraction) => fractions.push(fraction)) : null;
    installer.progress({ phase: 'downloading', receivedBytes: 25, totalBytes: 100 });
    installer.progress({ phase: 'finishing' });
    await installer.succeed();
    await downloading;
    expect(fractions).toEqual([0.25, 1]);
  });

  it('downloads nothing for the same version, nor when the installed one runs and is new enough', async () => {
    expect(await runtimeWith({ installed: [VERSION] }).runtime.prefetchFor(PIN)).toBeNull();
    expect(await runtimeWith({ chosen: 'automatic' }).runtime.prefetchFor(NEXT)).toBeNull();
  });

  it('downloads nothing where the platform has no bundle, nor for UVCS_CM_PATH', async () => {
    expect(await runtimeWith({ arch: 'arm64' }).runtime.prefetchFor(NEXT)).toBeNull();
    expect(await runtimeWith({ environmentPath: '/dev/cm' }).runtime.prefetchFor(NEXT)).toBeNull();
  });

  describe('when the installed one runs and is older than the update needs', () => {
    const LATER: CmVersionPin = { ...PIN, version: '11.0.16.10800' };

    it('downloads its installer with the update, and runs it at the update’s version when asked', async () => {
      const { runtime, officialUpdate } = runtimeWith({ chosen: 'automatic' });
      runtime.admits('/usr/bin/cm', INSTALLED_VERSION);
      const prefetch = await runtime.prefetchFor(LATER);
      expect(prefetch).toMatchObject({ kind: 'installed', installed: { path: '/usr/bin/cm', version: INSTALLED_VERSION }, neededVersion: '11.0.16.10800' });
      if (prefetch?.kind !== 'installed') return;
      await prefetch.download(() => undefined);
      expect(officialUpdate.downloadsAhead).toEqual([{ installed: { path: '/usr/bin/cm', version: INSTALLED_VERSION }, floor: '11.0.16.10800' }]);
      officialUpdate.outcome.updatesTo = '11.0.16.10800';
      expect(await prefetch.install()).toBe(true);
      expect(officialUpdate.installs).toEqual([{ path: '/usr/bin/cm', version: INSTALLED_VERSION }]);
    });

    it('runs no installer on Restart & Install when the installed one was updated to the update’s version meanwhile', async () => {
      let version = INSTALLED_VERSION;
      const { runtime, officialUpdate } = runtimeWith({ chosen: 'automatic', versionOf: async () => version });
      runtime.admits('/usr/bin/cm', INSTALLED_VERSION);
      const prefetch = await runtime.prefetchFor(LATER);
      if (prefetch?.kind !== 'installed') throw new Error('expected the installed one’s update');

      version = '11.0.16.10800';
      expect(await prefetch.install()).toBe(true);
      expect(officialUpdate.installs).toEqual([]);
    });

    it('reads its version when it hasn’t answered yet', async () => {
      const { runtime } = runtimeWith({ chosen: 'installed' });
      expect(await runtime.prefetchFor(LATER)).toMatchObject({ kind: 'installed', installed: { version: INSTALLED_VERSION } });
    });

    it('names the command on Linux, downloading nothing', async () => {
      const { runtime, officialUpdate } = runtimeWith({ chosen: 'automatic' });
      officialUpdate.by = 'command';
      expect(await runtime.prefetchFor(LATER)).toEqual({ kind: 'installedByCommand', installed: { path: '/usr/bin/cm', version: INSTALLED_VERSION }, neededVersion: '11.0.16.10800' });
    });

    it('asks nothing where it can’t be updated from here', async () => {
      const { runtime, officialUpdate } = runtimeWith({ chosen: 'automatic' });
      officialUpdate.by = null;
      expect(await runtime.prefetchFor(LATER)).toBeNull();
    });

    it('leaves it alone when the app’s own runs: that one downloads instead', async () => {
      const { runtime } = runtimeWith({ chosen: 'managed', installed: [VERSION] });
      expect((await runtime.prefetchFor(LATER))?.kind).toBe('own');
    });
  });
});

describe('CmRuntime pruning the store', () => {
  it('drops the installed one’s update once a launch, as soon as a cm runs that needs none', () => {
    const { runtime, officialUpdate } = runtimeWith({ chosen: 'automatic', installed: [VERSION] });
    runtime.start();
    expect(officialUpdate.discards).toBe(0);
    runtime.admits('/usr/bin/cm', INSTALLED_VERSION);
    runtime.admits('/usr/bin/cm', INSTALLED_VERSION);
    expect(officialUpdate.discards).toBe(1);
  });

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
    const { runtime, installer, statuses, relocations, choice } = runtimeWith({ chosen: 'automatic' });
    runtime.start();
    await runtime.use('managed');
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed', switchingToOwn: { kind: 'downloading', fraction: null } });
    installer.progress({ phase: 'downloading', receivedBytes: 40, totalBytes: 100 });
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed', switchingToOwn: { kind: 'downloading', fraction: 0.4 } });
    expect(choice()).toBe('automatic');

    await installer.succeed();
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed' });
    expect(choice()).toBe('managed');
    expect(relocations()).toBe(1);
  });

  it('stays on the installed one when it’s chosen again while its own downloads', async () => {
    const { runtime, installer, statuses, relocations, choice } = runtimeWith({ chosen: 'automatic' });
    await runtime.use('managed');
    await runtime.use('installed');
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
    await installer.succeed();
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(choice()).toBe('installed');
    expect(relocations()).toBe(0);
  });

  it('stays on the installed one, saying why, when its own fails to download', async () => {
    const { runtime, installer, statuses, relocations, choice } = runtimeWith({ chosen: 'automatic' });
    await runtime.use('managed');
    await installer.fail(new CmInstallError('unavailable', 'HTTP 403'));
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed', switchingToOwn: { kind: 'failed', failure: 'unavailable', detail: 'HTTP 403' } });
    expect(choice()).toBe('automatic');
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

describe('CmRuntime by default', () => {
  it('runs the installed cm when one is found, with nothing to set up', () => {
    const { runtime, installer } = runtimeWith({ chosen: 'automatic' });
    runtime.start();
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'installed' });
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(installer.installs).toBe(0);
  });

  it('sets its own up when none is found', () => {
    const { runtime, installer } = runtimeWith({ chosen: 'automatic', findInstalled: () => null });
    runtime.start();
    expect(runtime.status()).toMatchObject({ kind: 'installing', firstRun: true });
    expect(installer.installs).toBe(1);
  });

  it('prunes all of its own once the installed one’s version is known to be new enough, and only then', () => {
    const { runtime, pruned } = runtimeWith({ chosen: 'automatic', installed: [VERSION] });
    runtime.start();
    expect(pruned).toEqual([]);
    expect(runtime.admits('/usr/bin/cm', INSTALLED_VERSION)).toBe(true);
    expect(pruned).toEqual([null]);
  });
});

describe('CmRuntime with an installed cm older than its own', () => {
  const OLDER = '11.0.16.9000';
  const TOO_OLD: CmRuntimeStatus = { kind: 'installedTooOld', installed: { path: '/usr/bin/cm', version: OLDER }, requiredVersion: VERSION };

  it('asks to update it, running nothing meanwhile, when its version answers', () => {
    const { runtime, statuses, choice, pruned } = runtimeWith({ chosen: 'automatic', installed: [VERSION] });
    runtime.start();
    expect(runtime.admits('/usr/bin/cm', `${OLDER}\n`)).toBe(false);
    expect(statuses.at(-1)).toEqual(TOO_OLD);
    expect(runtime.isReady()).toBe(false);
    expect(choice()).toBe('automatic');
    expect(pruned).toEqual([]);
  });

  it('runs its own for now, set up first when it isn’t there, and remembers that for this pinned version', async () => {
    const { runtime, installer, statuses, choice, declined, relocations } = runtimeWith({ chosen: 'automatic' });
    runtime.start();
    runtime.admits('/usr/bin/cm', OLDER);
    runtime.useIncludedForNow();
    expect(statuses.at(-1)).toMatchObject({ kind: 'installing', firstRun: true });
    await installer.succeed();
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed' });
    expect(choice()).toBe('automatic');
    expect(declined()).toBe(VERSION);
    expect(relocations()).toBeGreaterThan(0);
  });

  it('drops the update downloading in the background once the user runs its own for now', () => {
    const { runtime, officialUpdate } = runtimeWith({ chosen: 'automatic', installed: [VERSION] });
    runtime.start();
    runtime.admits('/usr/bin/cm', OLDER);
    runtime.prepareUpdate();
    expect(officialUpdate.discards).toBe(0);
    runtime.useIncludedForNow();
    expect(officialUpdate.discards).toBeGreaterThan(0);
  });

  it('runs its own without asking when the user chose it for this pinned version before', () => {
    const { runtime, statuses, pruned } = runtimeWith({ chosen: 'automatic', installed: [VERSION], declinedFor: VERSION });
    runtime.start();
    expect(runtime.admits('/usr/bin/cm', OLDER)).toBe(false);
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed' });
    expect(pruned).toEqual([VERSION]);
  });

  it('asks again once the pinned version moved past the one the user chose its own for', () => {
    const { runtime, statuses } = runtimeWith({ chosen: 'automatic', installed: [VERSION], declinedFor: '11.0.16.10000' });
    runtime.start();
    runtime.admits('/usr/bin/cm', OLDER);
    expect(statuses.at(-1)).toEqual(TOO_OLD);
  });

  it('runs the installed one once Check Again finds it new enough, starting its shells again on the replaced cm', async () => {
    let version = OLDER;
    const { runtime, statuses, relocations, replacements } = runtimeWith({ chosen: 'automatic', installed: [VERSION], versionOf: async () => version });
    runtime.start();
    runtime.admits('/usr/bin/cm', OLDER);
    await runtime.checkInstalledAgain();
    expect(statuses.at(-1)).toEqual(TOO_OLD);
    expect(relocations()).toBe(0);

    version = INSTALLED_VERSION;
    await runtime.checkInstalledAgain();
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(relocations()).toBe(1);
    // Updated outside the app, at the same path: the shells started before still run the older one.
    expect(replacements()).toBe(1);
  });

  it('says which version Check Again found when it’s still too old', async () => {
    const { runtime, statuses } = runtimeWith({ chosen: 'automatic', installed: [VERSION], versionOf: async () => '11.0.16.9500' });
    runtime.start();
    runtime.admits('/usr/bin/cm', OLDER);
    await runtime.checkInstalledAgain();
    expect(statuses.at(-1)).toEqual({ ...TOO_OLD, installed: { path: '/usr/bin/cm', version: '11.0.16.9500' } });
  });

  it('reads the version once for Check Again asked again while it reads', async () => {
    let reads = 0;
    const { runtime } = runtimeWith({ chosen: 'automatic', installed: [VERSION], versionOf: async () => (reads++, OLDER) });
    runtime.admits('/usr/bin/cm', OLDER);
    await Promise.all([runtime.checkInstalledAgain(), runtime.checkInstalledAgain()]);
    expect(reads).toBe(1);
  });

  it('runs its own when Check Again finds none installed any more', async () => {
    let found: string | null = '/usr/bin/cm';
    const { runtime, statuses } = runtimeWith({ chosen: 'automatic', installed: [VERSION], findInstalled: () => found });
    runtime.start();
    runtime.admits('/usr/bin/cm', OLDER);
    found = null;
    await runtime.checkInstalledAgain();
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed' });
  });

  it('gets the update ready as the update screen shows, for the installed one', () => {
    const { runtime, officialUpdate } = runtimeWith({ chosen: 'automatic', installed: [VERSION] });
    runtime.prepareUpdate();
    expect(officialUpdate.prepared).toEqual([]);
    runtime.admits('/usr/bin/cm', OLDER);
    runtime.prepareUpdate();
    expect(officialUpdate.prepared).toEqual([{ path: '/usr/bin/cm', version: OLDER }]);
  });

  it('shows where the update stands on the update screen', () => {
    const { runtime, officialUpdate, statuses } = runtimeWith({ chosen: 'automatic', installed: [VERSION] });
    runtime.admits('/usr/bin/cm', OLDER);
    officialUpdate.set({ kind: 'installing', version: '11.0.16.10694' });
    expect(statuses.at(-1)).toEqual({ ...TOO_OLD, officialUpdate: { kind: 'installing', version: '11.0.16.10694' } });
  });

  it('runs the installed one once its update installed, starting its shells again, with no restart', async () => {
    let version = OLDER;
    const { runtime, officialUpdate, statuses, relocations, replacements } = runtimeWith({ chosen: 'automatic', installed: [VERSION], versionOf: async () => version });
    runtime.admits('/usr/bin/cm', OLDER);
    officialUpdate.outcome.updatesTo = version = '11.0.16.10694';
    await runtime.updateInstalled();
    // Its shells ended while the installer ran (`CmClient.hold`), and started on the new one as it resumed.
    expect(replacements()).toBe(0);
    expect(officialUpdate.installs).toEqual([{ path: '/usr/bin/cm', version: OLDER }]);
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(relocations()).toBe(1);
    expect(runtime.installedRevision()).toBe(1);
  });

  it('stays on the update screen when the update failed', async () => {
    const { runtime, officialUpdate } = runtimeWith({ chosen: 'automatic', installed: [VERSION], versionOf: async () => OLDER });
    runtime.admits('/usr/bin/cm', OLDER);
    await runtime.updateInstalled();
    expect(officialUpdate.installs).toHaveLength(1);
    expect(runtime.status()).toEqual(TOO_OLD);
    expect(runtime.installedRevision()).toBe(0);
  });

  it('updates it from Settings while its own runs, and runs it then', async () => {
    let version = OLDER;
    const { runtime, officialUpdate, statuses } = runtimeWith({ chosen: 'automatic', installed: [VERSION], declinedFor: VERSION, versionOf: async () => version });
    runtime.admits('/usr/bin/cm', OLDER);
    expect(runtime.cmPath()).toBe(MANAGED);
    officialUpdate.set({ kind: 'downloading', version: '11.0.16.10694', receivedBytes: 1, totalBytes: 2, installRequested: true });
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'managed', officialUpdate: { kind: 'downloading', version: '11.0.16.10694', receivedBytes: 1, totalBytes: 2, installRequested: true } });
    officialUpdate.set(null);
    officialUpdate.outcome.updatesTo = '11.0.16.10694';
    const update = runtime.updateInstalled();
    version = '11.0.16.10694';
    await update;
    expect(officialUpdate.installs).toEqual([{ path: '/usr/bin/cm', version: OLDER }]);
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
  });

  it('runs the installed one once updated from Settings, even when the user chose its own: updating it is choosing it', async () => {
    let version = OLDER;
    const { runtime, officialUpdate, choice, declined, statuses } = runtimeWith({ chosen: 'managed', installed: [VERSION], declinedFor: VERSION, versionOf: async () => version });
    officialUpdate.outcome.updatesTo = '11.0.16.10694';
    const update = runtime.updateInstalled();
    version = '11.0.16.10694';
    await update;
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(choice()).toBe('automatic');
    expect(declined()).toBeNull();
    expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
  });

  it('keeps the installed one chosen once updated, and forgets the included one was used for now', async () => {
    let version = OLDER;
    const { runtime, officialUpdate, choice, declined } = runtimeWith({ chosen: 'installed', installed: [VERSION], declinedFor: VERSION, versionOf: async () => version });
    runtime.admits('/usr/bin/cm', OLDER);
    officialUpdate.outcome.updatesTo = '11.0.16.10694';
    const update = runtime.updateInstalled();
    version = '11.0.16.10694';
    await update;
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(choice()).toBe('installed');
    expect(declined()).toBeNull();
  });

  it('keeps the user’s choice when the update from Settings failed', async () => {
    const { runtime, choice, declined } = runtimeWith({ chosen: 'managed', installed: [VERSION], declinedFor: VERSION, versionOf: async () => OLDER });
    await runtime.updateInstalled();
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(choice()).toBe('managed');
    expect(declined()).toBe(VERSION);
  });

  it('updates nothing from Settings when the installed one is new enough or none is found', async () => {
    const { runtime, officialUpdate } = runtimeWith({ chosen: 'managed', installed: [VERSION] });
    await runtime.updateInstalled();
    const none = runtimeWith({ chosen: 'managed', installed: [VERSION], findInstalled: () => null });
    await none.runtime.updateInstalled();
    expect([...officialUpdate.installs, ...none.officialUpdate.installs]).toEqual([]);
  });

  it('runs the installed one again at the next launch once it’s new enough, without asking', () => {
    const { runtime } = runtimeWith({ chosen: 'automatic', installed: [VERSION], declinedFor: VERSION });
    runtime.start();
    expect(runtime.cmPath()).toBe('/usr/bin/cm');
    expect(runtime.admits('/usr/bin/cm', INSTALLED_VERSION)).toBe(true);
    expect(runtime.status()).toEqual({ kind: 'ready', source: 'installed' });
  });

  it('never runs an older installed one when the user chooses it', async () => {
    const { runtime, statuses, choice, relocations } = runtimeWith({ installed: [VERSION], versionOf: async () => OLDER });
    runtime.start();
    await runtime.use('installed');
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(choice()).toBe('managed');
    expect(statuses).toEqual([]);
    expect(relocations()).toBe(0);
  });

  it('asks to update it when the user chose it before and it’s older now', () => {
    const { runtime, statuses } = runtimeWith({ chosen: 'installed', installed: [VERSION] });
    runtime.start();
    expect(runtime.admits('/usr/bin/cm', OLDER)).toBe(false);
    expect(statuses.at(-1)).toEqual(TOO_OLD);
  });

  it('offers no older installed one when its own fails to set up', async () => {
    const { runtime, installer } = runtimeWith({ versionOf: async () => OLDER });
    runtime.start();
    await installer.fail(new Error('net::ERR_INTERNET_DISCONNECTED'));
    expect(runtime.status()).toMatchObject({ kind: 'failed', installedCm: null });
  });

  it('admits its own, the environment’s and an installed one as new as its own or newer, under either choice', () => {
    expect(runtimeWith({ installed: [VERSION] }).runtime.admits(MANAGED, '11.0.16.1')).toBe(true);
    expect(runtimeWith({ chosen: 'automatic', findInstalled: () => null, installed: [VERSION] }).runtime.admits(MANAGED, '11.0.16.1')).toBe(true);
    expect(runtimeWith({ environmentPath: '/fake/cm' }).runtime.admits('/fake/cm', '1.0.0.0')).toBe(true);
    expect(runtimeWith({ chosen: 'automatic' }).runtime.admits('/usr/bin/cm', VERSION)).toBe(true);
    expect(runtimeWith({ chosen: 'automatic' }).runtime.admits('/usr/bin/cm', INSTALLED_VERSION)).toBe(true);
  });

  it('runs nothing where it has no cm of its own (Linux on Arm), under either choice, naming both versions', () => {
    for (const chosen of ['automatic', 'managed'] as const) {
      const { runtime, statuses } = runtimeWith({ arch: 'arm64', chosen });
      runtime.start();
      expect(runtime.admits('/usr/bin/cm', OLDER)).toBe(false);
      expect(runtime.cmPath()).toBe('/usr/bin/cm');
      expect(statuses).toEqual([{ kind: 'ready', source: 'installed', installedTooOld: { installed: { path: '/usr/bin/cm', version: OLDER }, requiredVersion: VERSION } }]);
      expect(runtime.admits('/usr/bin/cm', INSTALLED_VERSION)).toBe(true);
      expect(statuses.at(-1)).toEqual({ kind: 'ready', source: 'installed' });
    }
  });

  it('keeps the user’s last choice when Installed was clicked first and its version answers after', async () => {
    let answer: (version: string) => void = () => undefined;
    const { runtime, choice } = runtimeWith({ installed: [VERSION], versionOf: () => new Promise((resolve) => (answer = resolve)) });
    runtime.start();
    const installed = runtime.use('installed');
    await runtime.use('managed');
    answer(INSTALLED_VERSION);
    await installed;
    expect(runtime.cmPath()).toBe(MANAGED);
    expect(choice()).toBe('managed');
  });

  it('answers only for the cm running: another one asked before a switch is none of its business', () => {
    const { runtime } = runtimeWith({ chosen: 'automatic' });
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
