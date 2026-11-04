import { describe, expect, it } from 'vitest';
import { StepQueue } from './stepQueue';

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
