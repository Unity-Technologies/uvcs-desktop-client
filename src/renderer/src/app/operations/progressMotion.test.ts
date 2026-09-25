import { describe, expect, it } from 'vitest';
import { barPosition, formatRemaining, nextBarMotion, REACH_MS, remainingMs } from './progressMotion';

describe('nextBarMotion', () => {
  it('moves quickly to the first report', () => {
    expect(nextBarMotion(null, 'a', 0.2, 1000)).toMatchObject({ from: 0, to: 0.2, durationMs: REACH_MS });
  });

  it('heads for where the next report should land, arriving when it is due', () => {
    const first = nextBarMotion(null, 'a', 0.1, 0);
    const second = nextBarMotion(first, 'a', 0.2, 5000);
    expect(second.to).toBeCloseTo(0.3);
    expect(second.durationMs).toBe(5000);
  });

  it('runs at most halfway into what is left', () => {
    const first = nextBarMotion(null, 'a', 0.1, 0);
    expect(nextBarMotion(first, 'a', 0.7, 5000).to).toBeCloseTo(0.85);
  });

  it('never goes backwards: a slower report holds the bar where it is', () => {
    const first = nextBarMotion(null, 'a', 0.1, 0);
    const second = nextBarMotion(first, 'a', 0.3, 1000);
    const third = nextBarMotion(second, 'a', 0.32, 2000);
    expect(third.from).toBeCloseTo(0.5);
    expect(third.to).toBeCloseTo(0.5);
  });

  it('starts over for a new stretch of work', () => {
    const first = nextBarMotion(null, 'step 1', 0.9, 0);
    expect(nextBarMotion(first, 'step 2', 0.1, 1000)).toMatchObject({ from: 0, to: 0.1, key: 'step 2' });
  });

  it('reaches the end quickly', () => {
    const first = nextBarMotion(null, 'a', 0.5, 0);
    expect(nextBarMotion(first, 'a', 1, 200)).toMatchObject({ to: 1, durationMs: REACH_MS });
  });
});

describe('barPosition', () => {
  it('moves linearly and stops at the target', () => {
    const motion = { key: 'a', from: 0.2, to: 0.6, startedAt: 0, durationMs: 1000, first: { at: 0, fraction: 0 }, last: { at: 0, fraction: 0 } };
    expect(barPosition(motion, 500)).toBeCloseTo(0.4);
    expect(barPosition(motion, 5000)).toBeCloseTo(0.6);
  });
});

describe('remainingMs', () => {
  it('waits for a meaningful pace', () => {
    const first = nextBarMotion(null, 'a', 0.1, 0);
    expect(remainingMs(nextBarMotion(first, 'a', 0.2, 1000))).toBeNull();
  });

  it('estimates from the pace since the stretch started', () => {
    const first = nextBarMotion(null, 'a', 0.1, 0);
    expect(remainingMs(nextBarMotion(first, 'a', 0.3, 4000))).toBeCloseTo(14000);
  });

  it('stays quiet near the end', () => {
    const first = nextBarMotion(null, 'a', 0.1, 0);
    expect(remainingMs(nextBarMotion(first, 'a', 0.98, 4000))).toBeNull();
  });
});

describe('formatRemaining', () => {
  it('rounds to coarse steps', () => {
    expect(formatRemaining(12_000)).toBe('About 15 s left');
    expect(formatRemaining(2_000)).toBe('About 5 s left');
    expect(formatRemaining(170_000)).toBe('About 3 min left');
  });
});
