import { describe, expect, it } from 'vitest';
import { pressTarget, StepQueue } from './stepQueue';

describe('StepQueue', () => {
  it('gives the presses kept for a file back to that file, in order, once each', () => {
    const queue = new StepQueue();
    queue.push('b.cs', 1);
    queue.push('b.cs', -1);
    expect([queue.take('b.cs'), queue.take('b.cs'), queue.take('b.cs')]).toEqual([1, -1, undefined]);
  });

  it("drops the presses meant for another file: they were for a diff that's no longer selected", () => {
    const queue = new StepQueue();
    queue.push('b.cs', 1);
    queue.push('c.cs', -1);
    expect(queue.take('c.cs')).toBe(-1);
    expect(queue.take('b.cs')).toBeUndefined();
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
