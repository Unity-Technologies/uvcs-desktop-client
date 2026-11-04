import { describe, expect, it } from 'vitest';
import type { PressEffect } from './pressRouting';
import { drainKept, StepQueue } from './stepQueue';

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

describe('drainKept', () => {
  /** A queue holding `presses` for b.cs, and a go answering each press with the next of `effects`, recording it. */
  function drain(presses: (1 | -1)[], effects: PressEffect[]) {
    const queue = new StepQueue();
    for (const press of presses) queue.push('b.cs', press);
    const taken: (1 | -1)[] = [];
    drainKept(queue, 'b.cs', (direction) => {
      taken.push(direction);
      return effects[taken.length - 1]!;
    });
    const left = [queue.take('b.cs'), queue.take('b.cs'), queue.take('b.cs')].filter((press) => press !== undefined);
    return { taken, left };
  }

  it('takes one press that moves the view: the render it brings takes the next, from where it left the view', () => {
    expect(drain([1, -1], ['moved'])).toEqual({ taken: [1], left: [-1] });
  });

  it('goes on past a press that does nothing (at the last change of the last file), which brings no render to take the next', () => {
    expect(drain([1, 1, -1], ['none', 'none', 'moved'])).toEqual({ taken: [1, 1, -1], left: [] });
  });

  it('stops at a press that went on to another file or was kept for one: their presses wait for that file', () => {
    expect(drain([1, -1], ['file'])).toEqual({ taken: [1], left: [-1] });
    expect(drain([1, -1], ['kept'])).toEqual({ taken: [1], left: [-1] });
  });
});
