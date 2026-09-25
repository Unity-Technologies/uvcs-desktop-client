import { describe, expect, it } from 'vitest';
import type { OperationProgress } from '@shared/domain/operation';
import { nextProgressBar, SWEEP } from './progressBar';
import { REACH_MS } from './progressMotion';

const at = (fraction: number | null, stepIndex?: number): OperationProgress => ({
  stage: fraction === null ? 'confirming' : 'uploading',
  stageLabel: 'x',
  fraction,
  ...(stepIndex && { step: { label: 'step', index: stepIndex, count: 3 } }),
});

describe('nextProgressBar', () => {
  it('sweeps until a fraction is known', () => {
    expect(nextProgressBar(SWEEP, at(null), 0)).toMatchObject({ mode: 'sweep' });
  });

  it('fills up to the reported fraction', () => {
    expect(nextProgressBar(SWEEP, at(0.3), 0)).toMatchObject({ mode: 'fill', value: 0.3 });
  });

  it('sweeps while hardly anything is done, then catches up quickly and paces itself from the reports so far', () => {
    const started = nextProgressBar(SWEEP, at(0.002), 0);
    expect(started).toMatchObject({ mode: 'sweep' });
    const caughtUp = nextProgressBar(started, at(0.2), 5000);
    expect(caughtUp).toMatchObject({ mode: 'fill', value: 0.2, durationMs: REACH_MS });
    expect(nextProgressBar(caughtUp, at(0.4), 10000)).toMatchObject({ mode: 'fill', durationMs: 5000, value: expect.closeTo(0.6) });
  });

  it('stays full and busy when the measured part is over but the work goes on', () => {
    const uploading = nextProgressBar(SWEEP, at(0.9), 0);
    expect(nextProgressBar(uploading, at(null), 100)).toMatchObject({ mode: 'busy', value: 1 });
  });

  it('sweeps when the unmeasured part is real work, not wrapping up (a merge downloading its files)', () => {
    const applying = nextProgressBar(SWEEP, at(0.9), 0);
    expect(nextProgressBar(applying, { stage: 'downloading', stageLabel: 'Downloading files', fraction: null }, 100)).toMatchObject({ mode: 'sweep' });
  });

  it('sweeps again for a new step that has no fraction yet', () => {
    const switching = nextProgressBar(SWEEP, at(0.9, 3), 0);
    expect(nextProgressBar(switching, at(null, 4), 100)).toMatchObject({ mode: 'sweep' });
  });
});
