import { describe, expect, it } from 'vitest';
import { applyPress, pressGoal, routePress, takesKept, type PressSpot } from './pressRouting';
import { StepQueue } from './stepQueue';

const opened: PressSpot = { holder: 'view', path: 'a.cs', opened: true, steppingTo: null };

describe('routePress', () => {
  it('steps through a view once it opened, with no step to another file in flight', () => {
    expect(routePress(opened)).toEqual({ kind: 'step' });
  });

  it("keeps a press for the file a step went to while the view shown is still the previous one's (its selection settling)", () => {
    expect(routePress({ ...opened, steppingTo: 'b.cs' })).toEqual({ kind: 'keep', path: 'b.cs' });
  });

  it('keeps a press for the view itself until it opened at its arrival, else the arrival would move it back', () => {
    expect(routePress({ ...opened, opened: false })).toEqual({ kind: 'keep', path: 'a.cs' });
    expect(routePress({ ...opened, opened: false, steppingTo: 'a.cs' })).toEqual({ kind: 'keep', path: 'a.cs' });
  });

  it("keeps a header's presses while the selected file's diff is read or drawn, for it or the file a step is on its way to", () => {
    expect(routePress({ ...opened, holder: 'waiting' })).toEqual({ kind: 'keep', path: 'a.cs' });
    expect(routePress({ ...opened, holder: 'waiting', steppingTo: 'b.cs' })).toEqual({ kind: 'keep', path: 'b.cs' });
  });

  it('steps from file to file where there is no view to step through (a file that could not be read, an xlink)', () => {
    expect(routePress({ ...opened, holder: 'stepless', opened: false })).toEqual({ kind: 'step' });
  });
});

describe('pressGoal', () => {
  const atLast = { count: 3, current: 2, above: 0 };
  const lastFile = { canStep: () => false };
  const fileAfter = { canStep: () => true };

  it('goes through the steps, then on to the file beside it, and nowhere past the last of the last file', () => {
    expect(pressGoal(opened, { ...atLast, current: 1 }, 1, lastFile)).toBe('step');
    expect(pressGoal(opened, atLast, 1, fileAfter)).toBe('file');
    expect(pressGoal(opened, atLast, 1, lastFile)).toBeNull();
    expect(pressGoal(opened, atLast, 1, null)).toBeNull();
  });

  it("is enabled, its tip neutral, while the press would be kept: a step to the list's last file still settling disables nothing", () => {
    expect(pressGoal({ ...opened, steppingTo: 'b.cs' }, atLast, 1, lastFile)).toBe('queued');
    expect(pressGoal({ ...opened, holder: 'waiting' }, atLast, -1, null)).toBe('queued');
  });
});

describe('applyPress', () => {
  /** A list of a.cs, b.cs: a step selects the file beside (`step`), and the press's effects are recorded. */
  function press(spot: PressSpot, position: { count: number; current: number | null; above: number }, direction: 1 | -1, canStep = true) {
    const queue = new StepQueue();
    queue.push(spot.path, -1);
    const moves: number[] = [];
    const files = { canStep: () => canStep, step: () => (canStep ? 'b.cs' : null) };
    const effect = applyPress(direction, spot, { position, files, queue, readAbove: () => 0, moveTo: (index) => void moves.push(index) });
    return { effect, moves, queue };
  }

  it('moves the view to the next step', () => {
    expect(press(opened, { count: 3, current: 0, above: 0 }, 1)).toMatchObject({ effect: 'moved', moves: [1] });
  });

  it('goes on to the next file past the last step, and the presses left for this file follow it there, in order', () => {
    const { effect, queue } = press(opened, { count: 3, current: 2, above: 0 }, 1);
    expect(effect).toBe('file');
    expect([queue.take('a.cs'), queue.take('b.cs')]).toEqual([undefined, -1]);
  });

  it('does nothing past the last step of the last file, the presses left staying', () => {
    const { effect, queue } = press(opened, { count: 3, current: 2, above: 0 }, 1, false);
    expect(effect).toBe('none');
    expect(queue.take('a.cs')).toBe(-1);
  });

  it('keeps the press for the file it is meant for', () => {
    const { effect, queue } = press({ ...opened, steppingTo: 'b.cs' }, { count: 3, current: 0, above: 0 }, 1);
    expect(effect).toBe('kept');
    expect(queue.take('b.cs')).toBe(1);
  });
});

describe('takesKept', () => {
  it("lets a view take the presses kept for it once it opened at its arrival, while it's the selected file's", () => {
    expect(takesKept('view', { opened: true, selected: true })).toBe(true);
    expect(takesKept('view', { opened: false, selected: true })).toBe(false);
    expect(takesKept('view', { opened: true, selected: false })).toBe(false);
  });

  it('lets a view with no steps replay them as steps from file to file at once: its diff never comes', () => {
    expect(takesKept('stepless', { opened: false, selected: true })).toBe(true);
  });

  it("never lets a header waiting for the selected file's diff take them: they're that diff's", () => {
    expect(takesKept('waiting', { opened: true, selected: true })).toBe(false);
  });
});
