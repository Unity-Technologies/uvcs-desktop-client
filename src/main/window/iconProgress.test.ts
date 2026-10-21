import { describe, expect, it } from 'vitest';
import type { OperationProgress } from '@shared/domain/operation';
import { combinedIconProgress, iconIsTheApp, operationIconProgress, progressBarCall } from './iconProgress';

function progress(fraction: number | null, stage: OperationProgress['stage'] = 'downloading'): OperationProgress {
  return { stage, stageLabel: 'Downloading', fraction };
}

describe('operationIconProgress', () => {
  it('is not measured until the operation reports how far along it is', () => {
    expect(operationIconProgress(null)).toEqual({ mode: 'unmeasured' });
    expect(operationIconProgress(progress(null, 'calculating'))).toEqual({ mode: 'unmeasured' });
  });

  it('shows how far along it is', () => {
    expect(operationIconProgress(progress(0.42))).toEqual({ mode: 'measured', value: 0.42 });
  });

  it('is not measured while hardly anything is done, as the progress card keeps sweeping', () => {
    expect(operationIconProgress(progress(0.005))).toEqual({ mode: 'unmeasured' });
  });

  it('is full while it wraps up after the measured work (a checkin confirming)', () => {
    expect(operationIconProgress(progress(null, 'confirming'))).toEqual({ mode: 'measured', value: 1 });
    expect(operationIconProgress(progress(null, 'finishing'))).toEqual({ mode: 'measured', value: 1 });
  });
});

describe('combinedIconProgress', () => {
  it('shows nothing while nothing runs', () => {
    expect(combinedIconProgress([], false)).toEqual({ mode: 'none' });
  });

  it('shows a failure once nothing runs', () => {
    expect(combinedIconProgress([], true)).toEqual({ mode: 'failed' });
    expect(combinedIconProgress([{ mode: 'measured', value: 0.5 }], true)).toEqual({ mode: 'measured', value: 0.5 });
  });

  it('is not measured while no operation is', () => {
    expect(combinedIconProgress([{ mode: 'unmeasured' }, { mode: 'unmeasured' }], false)).toEqual({ mode: 'unmeasured' });
  });

  it('shows how far along the operations are together, one not measured yet counting as none done', () => {
    expect(combinedIconProgress([{ mode: 'measured', value: 0.8 }, { mode: 'unmeasured' }], false)).toEqual({ mode: 'measured', value: 0.4 });
    expect(combinedIconProgress([{ mode: 'measured', value: 0.2 }, { mode: 'measured', value: 0.6 }], false)).toEqual({ mode: 'measured', value: 0.4 });
  });
});

describe('iconIsTheApp', () => {
  it('is the whole app on the Dock and the Linux launcher, each window on the Windows taskbar', () => {
    expect(iconIsTheApp('darwin')).toBe(true);
    expect(iconIsTheApp('linux')).toBe(true);
    expect(iconIsTheApp('win32')).toBe(false);
  });
});

describe('progressBarCall', () => {
  it('hides the bar when nothing runs', () => {
    for (const platform of ['darwin', 'linux', 'win32'] as const) expect(progressBarCall({ mode: 'none' }, platform)).toEqual({ value: -1 });
  });

  it('fills the bar as far as the operation is along', () => {
    expect(progressBarCall({ mode: 'measured', value: 0.3 }, 'darwin')).toEqual({ value: 0.3 });
    expect(progressBarCall({ mode: 'measured', value: 0.3 }, 'linux')).toEqual({ value: 0.3 });
    expect(progressBarCall({ mode: 'measured', value: 0.3 }, 'win32')).toEqual({ value: 0.3, mode: 'normal' });
  });

  it('pulses on Windows while it can not tell yet, and shows nothing where a full bar would read as done', () => {
    expect(progressBarCall({ mode: 'unmeasured' }, 'win32')).toEqual({ value: 1, mode: 'indeterminate' });
    expect(progressBarCall({ mode: 'unmeasured' }, 'darwin')).toEqual({ value: -1 });
    expect(progressBarCall({ mode: 'unmeasured' }, 'linux')).toEqual({ value: -1 });
  });

  it('turns red on Windows when it failed, and shows nothing where there is no red', () => {
    expect(progressBarCall({ mode: 'failed' }, 'win32')).toEqual({ value: 1, mode: 'error' });
    expect(progressBarCall({ mode: 'failed' }, 'darwin')).toEqual({ value: -1 });
    expect(progressBarCall({ mode: 'failed' }, 'linux')).toEqual({ value: -1 });
  });
});
