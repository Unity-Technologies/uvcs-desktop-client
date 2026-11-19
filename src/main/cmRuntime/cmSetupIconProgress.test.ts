import { describe, expect, it } from 'vitest';
import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
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
});
