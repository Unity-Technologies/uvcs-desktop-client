import { create } from 'zustand';
import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { cmSetupIn, type CmSetupStart } from '@shared/startingPlace';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../queryClient';
import { measureRate, secondsLeft, startRate, type DownloadRate } from './downloadRate';

interface CmRuntimeState {
  /** Where the app's `cm` stands, as the main process last said (`cmRuntimeChanged`). */
  status: CmRuntimeStatus;
  /** A status arrived from main: the one read at start (`loadCmRuntimeStatus`) is older then. */
  heardFromMain: boolean;
  /** The download's pace so far, measured as each status arrives; null while nothing downloads. */
  rate: DownloadRate | null;
}

/**
 * Where the window starts, from its address (`cmSetupQuery`), before its first frame: read as this module loads,
 * before `openPlaceFromAddress` clears the address.
 */
export function startingStatus(setup: CmSetupStart | null): CmRuntimeStatus {
  if (!setup) return { kind: 'ready', source: 'managed' };
  return { kind: 'installing', version: '', phase: 'downloading', receivedBytes: 0, totalBytes: null, firstRun: setup === 'settingUp' };
}

export const useCmRuntimeStore = create<CmRuntimeState>(() => ({
  status: startingStatus(cmSetupIn(window.location.search)),
  heardFromMain: false,
  rate: null,
}));

/** The rate after a status: measured while it downloads, forgotten otherwise. */
export function rateAfter(rate: DownloadRate | null, status: CmRuntimeStatus, at: number): DownloadRate | null {
  if (status.kind !== 'installing' || status.phase !== 'downloading') return null;
  return rate ? measureRate(rate, at, status.receivedBytes) : startRate(at, status.receivedBytes);
}

/** The time the download has left, once it can be said; null otherwise. */
export function useSecondsLeft(): number | null {
  return useCmRuntimeStore(({ status, rate }) => (rate && status.kind === 'installing' ? secondsLeft(rate, status.totalBytes) : null));
}

/** Whether nothing may ask `cm` yet: the app's own is still being set up, or its setup failed. */
export function isSettingUpCm(status: CmRuntimeStatus): boolean {
  return status.kind !== 'ready';
}

/** Whether another `cm` runs now: one that just became ready, or another source (Settings' choice). */
export function cmChanged(before: CmRuntimeStatus, after: CmRuntimeStatus): boolean {
  if (after.kind !== 'ready') return false;
  return before.kind !== 'ready' || before.source !== after.source;
}

function receive(status: CmRuntimeStatus): void {
  const before = useCmRuntimeStore.getState().status;
  useCmRuntimeStore.setState(({ rate }) => ({ status, heardFromMain: true, rate: rateAfter(rate, status, performance.now()) }));
  // What asked `cm` before it could run (a window's first reads) failed with "not found", and another one may be
  // another version: asked again now.
  if (cmChanged(before, status)) {
    void queryClient.resetQueries({ queryKey: queryKeys.cmVersion });
    void queryClient.resetQueries({ queryKey: queryKeys.cmSetup });
  }
}

window.uvcs.on('cmRuntimeChanged', receive);

/** Reads where the app's `cm` stands as the window opens; every change after that arrives as an event. */
export async function loadCmRuntimeStatus(): Promise<void> {
  const status = await api.cmRuntime.status();
  if (!useCmRuntimeStore.getState().heardFromMain) receive(status);
}
