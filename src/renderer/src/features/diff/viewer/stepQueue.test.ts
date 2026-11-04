import { describe, expect, it } from 'vitest';
import { drainsKept, pressTarget, StepQueue } from './stepQueue';

describe('StepQueue', () => {
  it('gives the presses kept for a file back to that file, in order, once each', () => {
    const queue = new StepQueue();
    queue.push('b.cs', 1);
    queue.push('b.cs', -1);
    expect([queue.take('b.cs'), queue.take('b.cs'), queue.take('b.cs')]).toEqual([1, -1, undefined]);
  });

  it("takes only a file's own presses, dropping none of another's: a diff still on screen while the next file is read takes nothing of the next file's", () => {
    const queue = new StepQueue();
    queue.push('b.cs', 1);
    expect(queue.take('a.cs')).toBeUndefined();
    expect(queue.take('b.cs')).toBe(1);
  });

  it('moves the presses left for a file on to the file a step from it went to, in order', () => {
    const queue = new StepQueue();
    queue.push('b.cs', 1);
    queue.push('c.cs', -1);
    queue.push('b.cs', -1);
    queue.retag('b.cs', 'c.cs');
    expect([queue.take('c.cs'), queue.take('c.cs'), queue.take('c.cs'), queue.take('b.cs')]).toEqual([1, -1, -1, undefined]);
  });

  it('drops the presses for files the selection left: those neither for the file asked for nor for one a step is on its way to', () => {
    const queue = new StepQueue();
    queue.push('a.cs', 1);
    queue.push('b.cs', 1);
    queue.push('c.cs', -1);
    queue.keepOnly(['c.cs', null]);
    expect([queue.take('a.cs'), queue.take('b.cs'), queue.take('c.cs')]).toEqual([undefined, undefined, -1]);
  });

  it('forgets them all', () => {
    const queue = new StepQueue();
    queue.push('b.cs', 1);
    queue.clear();
    expect(queue.take('b.cs')).toBeUndefined();
  });
});

describe('pressTarget', () => {
  const press = { opens: true, opened: true, steppingTo: null, path: 'a.cs' };

  it('steps through the diff shown once it opened, with no step to another file in flight', () => {
    expect(pressTarget(press)).toEqual({ kind: 'step' });
  });

  it("keeps a press for the file a step went to while the diff shown is still the previous one's (its selection settling)", () => {
    expect(pressTarget({ ...press, steppingTo: 'b.cs' })).toEqual({ kind: 'keep', path: 'b.cs' });
  });

  it('keeps a press for the diff itself until it opened at its arrival', () => {
    expect(pressTarget({ ...press, opened: false })).toEqual({ kind: 'keep', path: 'a.cs' });
    expect(pressTarget({ ...press, opened: false, steppingTo: 'a.cs' })).toEqual({ kind: 'keep', path: 'a.cs' });
  });

  it('steps at once where it opens nothing (a header with no diff of its own, an xlink)', () => {
    expect(pressTarget({ ...press, opens: false, opened: false, steppingTo: 'b.cs' })).toEqual({ kind: 'step' });
  });
});

describe('drainsKept', () => {
  it("lets a diff take its kept presses once it opened at its arrival, while it's the selected file's", () => {
    expect(drainsKept({ opened: true, selected: true })).toBe(true);
  });

  it('not before it opened, nor while it stays on screen for a previous file as the next one is read', () => {
    expect(drainsKept({ opened: false, selected: true })).toBe(false);
    expect(drainsKept({ opened: true, selected: false })).toBe(false);
  });
});
