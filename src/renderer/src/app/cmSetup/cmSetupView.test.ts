import { describe, expect, it } from 'vitest';
import type { CmInstallFailure, CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { CM_SETUP_DOWNLOAD_SHARE } from '@shared/domain/cmRuntime';
import { cmSetupViewOf, timeLeftText } from './cmSetupView';

const MB = 1024 * 1024;

function downloading(receivedBytes: number, totalBytes: number | null, firstRun = true): CmRuntimeStatus {
  return { kind: 'installing', version: '11.0.16.10659', phase: 'downloading', receivedBytes, totalBytes, firstRun };
}

function failed(failure: CmInstallFailure, firstRun = true): CmRuntimeStatus {
  return { kind: 'failed', version: '11.0.16.10659', failure, detail: 'HTTP 403 from https://downloads.example', firstRun, installedCm: null };
}

describe('cmSetupViewOf', () => {
  it('shows nothing once it’s ready', () => {
    expect(cmSetupViewOf({ kind: 'ready', source: 'managed' }, null)).toBeNull();
  });

  it('leaves the window to the update screen while the installed one is too old', () => {
    expect(cmSetupViewOf({ kind: 'installedTooOld', installed: { path: '/usr/bin/cm', version: '11.0.16.9000' }, requiredVersion: '11.0.16.10659' }, null)).toBeNull();
  });

  it('sets up on the first run, and updates after one', () => {
    expect(cmSetupViewOf(downloading(0, null), null)).toMatchObject({ title: 'Setting up Unity Version Control', subtitle: 'This happens once and takes a moment.' });
    expect(cmSetupViewOf(downloading(0, null, false), null)).toMatchObject({ title: 'Updating Unity Version Control', subtitle: 'A newer version came with this update.' });
  });

  it('shows the bar without a measure and no words before the size is known', () => {
    expect(cmSetupViewOf(downloading(0, null), null)).toMatchObject({ fraction: null, finishing: false, detail: null });
    expect(cmSetupViewOf(downloading(5 * MB, null), null)).toMatchObject({ fraction: null, detail: '5.0 MB' });
  });

  it('measures the download in the bar’s first stretch, with the time left once known', () => {
    expect(cmSetupViewOf(downloading(39 * MB, 78 * MB), null)).toMatchObject({ fraction: CM_SETUP_DOWNLOAD_SHARE / 2, detail: '39 MB of 78 MB' });
    expect(cmSetupViewOf(downloading(48 * MB, 78 * MB), 12.4)).toMatchObject({ detail: '48 MB of 78 MB · 12 s left' });
  });

  it('holds the bar’s last stretch while finishing', () => {
    const finishing: CmRuntimeStatus = { kind: 'installing', version: '11.0.16.10659', phase: 'finishing', receivedBytes: 78 * MB, totalBytes: 78 * MB, firstRun: true };
    expect(cmSetupViewOf(finishing, 3)).toMatchObject({ fraction: CM_SETUP_DOWNLOAD_SHARE, finishing: true, detail: 'Finishing…' });
  });

  it('says a failure in plain words, never the app’s inner names', () => {
    const failures: CmInstallFailure[] = ['offline', 'unreachable', 'proxyAuthentication', 'diskFull', 'notWritable', 'damaged', 'unavailable', 'blocked'];
    for (const failure of failures) {
      const screen = cmSetupViewOf(failed(failure), null);
      expect(screen?.kind).toBe('failed');
      if (screen?.kind === 'failed') expect(screen.reason).not.toMatch(/\bcm\b|command line|bundle|install|CLI|runtime/i);
    }
  });

  it('says whether it tries again by itself', () => {
    expect(cmSetupViewOf(failed('offline'), null)).toMatchObject({ retriesByItself: true, title: 'Unity Version Control couldn’t be set up' });
    expect(cmSetupViewOf(failed('diskFull', false), null)).toMatchObject({ retriesByItself: false, title: 'Unity Version Control couldn’t be updated' });
  });

  it('keeps what failed for the details', () => {
    expect(cmSetupViewOf(failed('unavailable'), null)).toMatchObject({ detail: 'HTTP 403 from https://downloads.example' });
  });
});

describe('timeLeftText', () => {
  it('says seconds, then whole minutes', () => {
    expect(timeLeftText(0.2)).toBe('1 s left');
    expect(timeLeftText(42.4)).toBe('42 s left');
    expect(timeLeftText(61)).toBe('2 min left');
  });
});

describe('cmSetupViewOf’s buttons on a failure', () => {
  it('offers Try Again, and the installed one by its version when one is found', () => {
    expect(cmSetupViewOf(failed('diskFull'), null)).toMatchObject({ tryAgainLabel: 'Try Again', useInstalledLabel: null });
    const withInstalled: CmRuntimeStatus = { ...failed('diskFull'), installedCm: { path: '/usr/bin/cm', version: '11.0.16.10700' } } as CmRuntimeStatus;
    expect(cmSetupViewOf(withInstalled, null)).toMatchObject({ useInstalledLabel: 'Use the Installed Version (11.0.16.10700)' });
  });
});
