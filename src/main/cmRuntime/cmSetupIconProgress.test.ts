import { describe, expect, it } from 'vitest';
import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
import type { OfficialUpdate } from '@shared/domain/officialUpdate';
import { UNMEASURED } from '../window/iconProgress';
import { cmSetupIconProgress } from './cmSetupIconProgress';

const installing = (phase: 'downloading' | 'finishing', receivedBytes: number, totalBytes: number | null): CmRuntimeStatus => ({
  kind: 'installing',
  version: '11.0.16.10659',
  phase,
  receivedBytes,
  totalBytes,
  firstRun: true,
});

describe('cmSetupIconProgress', () => {
  it('fills the icon’s bar as the setup screen’s', () => {
    expect(cmSetupIconProgress(installing('downloading', 50, 100))).toEqual({ mode: 'measured', value: 0.45 });
    expect(cmSetupIconProgress(installing('finishing', 100, 100))).toEqual({ mode: 'measured', value: 0.9 });
  });

  it('shows it unmeasured before the size is known', () => {
    expect(cmSetupIconProgress(installing('downloading', 0, null))).toEqual(UNMEASURED);
  });

  it('shows nothing once ready or failed', () => {
    expect(cmSetupIconProgress({ kind: 'ready', source: 'managed' })).toBeNull();
    expect(cmSetupIconProgress({ kind: 'failed', version: '11.0.16.10659', failure: 'offline', detail: '', firstRun: true, installedCm: null })).toBeNull();
  });

  describe('of the installed one’s update, once the user asked for it', () => {
    const tooOld = (officialUpdate: OfficialUpdate): CmRuntimeStatus => ({
      kind: 'installedTooOld',
      installed: { path: '/usr/local/bin/cm', version: '11.0.16.9000' },
      requiredVersion: '11.0.16.10659',
      officialUpdate,
    });
    const downloading = (installRequested: boolean): OfficialUpdate => ({ kind: 'downloading', version: '11.0.16.10694', receivedBytes: 50, totalBytes: 100, installRequested });

    it('fills the bar with its download, then runs it unmeasured while the installer runs', () => {
      expect(cmSetupIconProgress(tooOld(downloading(true)))).toEqual({ mode: 'measured', value: 0.45 });
      expect(cmSetupIconProgress(tooOld({ kind: 'lookingUp', installRequested: true }))).toEqual(UNMEASURED);
      expect(cmSetupIconProgress(tooOld({ kind: 'installing', version: '11.0.16.10694' }))).toEqual(UNMEASURED);
    });

    it('shows it from Settings too', () => {
      expect(cmSetupIconProgress({ kind: 'ready', source: 'managed', officialUpdate: { kind: 'installing', version: '11.0.16.10694' } })).toEqual(UNMEASURED);
    });

    it('shows nothing of a download in the background, or of a failure', () => {
      expect(cmSetupIconProgress(tooOld(downloading(false)))).toBeNull();
      expect(cmSetupIconProgress(tooOld({ kind: 'downloaded', version: '11.0.16.10694' }))).toBeNull();
      expect(cmSetupIconProgress(tooOld({ kind: 'failed', failure: 'declined', version: '11.0.16.10694', detail: '' }))).toBeNull();
    });
  });
});
