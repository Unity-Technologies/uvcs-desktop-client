import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../queryClient';
import { cmChanged, isSettingUpCm, loadCmRuntimeStatus, rateAfter, startingStatus, useCmRuntimeStore } from './cmRuntimeStore';

const initial = useCmRuntimeStore.getState();
const READY: CmRuntimeStatus = { kind: 'ready', source: 'managed' };
const downloading = (receivedBytes: number): CmRuntimeStatus => ({ kind: 'installing', version: '11.0.16.10659', phase: 'downloading', receivedBytes, totalBytes: 100, firstRun: true });

beforeEach(() => {
  useCmRuntimeStore.setState(initial, true);
  queryClient.clear();
});

describe('startingStatus', () => {
  it('starts ready when the window’s address names no setup', () => {
    expect(startingStatus(null)).toEqual(READY);
  });

  it('starts on the setup, or the update, the address names', () => {
    expect(startingStatus('settingUp')).toMatchObject({ kind: 'installing', firstRun: true });
    expect(startingStatus('updating')).toMatchObject({ kind: 'installing', firstRun: false });
  });
});

describe('isSettingUpCm', () => {
  it('holds the app back while it sets up and when that failed', () => {
    expect(isSettingUpCm(downloading(0))).toBe(true);
    expect(isSettingUpCm({ kind: 'failed', version: '11.0.16.10659', failure: 'offline', detail: '', firstRun: true, installedCm: null })).toBe(true);
    expect(isSettingUpCm(READY)).toBe(false);
  });
});

describe('cmChanged', () => {
  it('says another cm runs once the setup finishes, or the source changes', () => {
    expect(cmChanged(downloading(0), READY, false)).toBe(true);
    expect(cmChanged(READY, { kind: 'ready', source: 'installed' }, true)).toBe(true);
    expect(cmChanged(READY, READY, true)).toBe(false);
    expect(cmChanged(READY, downloading(0), true)).toBe(false);
  });

  it('changes nothing on the first answer of a window that started ready, whose source was a guess', () => {
    expect(cmChanged(READY, { kind: 'ready', source: 'installed' }, false)).toBe(false);
  });
});

describe('rateAfter', () => {
  it('measures while downloading, and forgets it otherwise', () => {
    const started = rateAfter(null, downloading(10), 0);
    expect(started).toMatchObject({ lastBytes: 10 });
    expect(rateAfter(started, downloading(30), 100)).toMatchObject({ lastBytes: 30, lastAt: 100 });
    expect(rateAfter(started, READY, 100)).toBeNull();
  });
});

describe('the status from main', () => {
  it('asks cm again what failed before it could run, once it runs', () => {
    useCmRuntimeStore.setState({ status: downloading(0) });
    queryClient.setQueryData(queryKeys.cmVersion, 'stale');
    fakeApi.emit('cmRuntimeChanged', READY);
    expect(useCmRuntimeStore.getState().status).toEqual(READY);
    expect(queryClient.getQueryData(queryKeys.cmVersion)).toBeUndefined();
  });

  it('keeps an event over the status read at start, which is older', async () => {
    let answer: (status: CmRuntimeStatus) => void = () => undefined;
    fakeApi.answer('cmRuntime.status', () => new Promise<CmRuntimeStatus>((resolve) => (answer = resolve)));
    const loading = loadCmRuntimeStatus();
    fakeApi.emit('cmRuntimeChanged', downloading(50));
    answer(downloading(0));
    await loading;
    expect(useCmRuntimeStore.getState().status).toEqual(downloading(50));
  });
});
