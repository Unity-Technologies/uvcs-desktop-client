import { describe, expect, it } from 'vitest';
import { coalesced } from './coalesced';

/** A schedule run by hand: `flush` runs what was scheduled so far. */
function manualSchedule() {
  const pending: (() => void)[] = [];
  return {
    schedule: (run: () => void) => void pending.push(run),
    flush: () => pending.splice(0).forEach((run) => run()),
    count: () => pending.length,
  };
}

describe('coalesced', () => {
  it('runs once for every call made before its scheduled run', () => {
    const { schedule, flush, count } = manualSchedule();
    let runs = 0;
    const request = coalesced(() => runs++, schedule);
    request();
    request();
    request();
    expect(count()).toBe(1);
    expect(runs).toBe(0);

    flush();
    expect(runs).toBe(1);
  });

  it('runs again for a call after its run', () => {
    const { schedule, flush } = manualSchedule();
    let runs = 0;
    const request = coalesced(() => runs++, schedule);
    request();
    flush();
    request();
    flush();
    expect(runs).toBe(2);
  });

  it('schedules another run for a call made while it runs', () => {
    const { schedule, flush, count } = manualSchedule();
    let runs = 0;
    const request = coalesced(() => {
      runs++;
      if (runs === 1) request();
    }, schedule);
    request();
    flush();
    expect(count()).toBe(1);
    flush();
    expect(runs).toBe(2);
  });
});
