import { describe, expect, it } from 'vitest';
import { adjacentKey, fileSteps, type PendingArrival } from './fileSteps';

describe('adjacentKey', () => {
  const keys = ['a', 'b', 'c'];

  it('finds the file after or before the one shown', () => {
    expect(adjacentKey(keys, 'b', 1)).toBe('c');
    expect(adjacentKey(keys, 'b', -1)).toBe('a');
  });

  it('stops at the ends, and without a file shown among them', () => {
    expect(adjacentKey(keys, 'c', 1)).toBeNull();
    expect(adjacentKey(keys, 'a', -1)).toBeNull();
    expect(adjacentKey(keys, 'x', 1)).toBeNull();
    expect(adjacentKey(keys, null, 1)).toBeNull();
  });
});

describe('fileSteps', () => {
  const list = (current: string) => {
    const selected: string[] = [];
    const pending: { current: PendingArrival | null } = { current: null };
    const steps = fileSteps(['a', 'b', 'c'], current, { select: (key) => void selected.push(key), pathOf: (key) => `src/${key}.ts` }, pending);
    return { steps, selected };
  };

  it("selects the next file to open at its first change, the previous at its last, told once to that file's diff", () => {
    const down = list('b');
    down.steps.step(1);
    expect(down.selected).toEqual(['c']);
    expect(down.steps.takeArrival('src/c.ts')).toBe('first');
    expect(down.steps.takeArrival('src/c.ts')).toBeNull();

    const up = list('b');
    up.steps.step(-1);
    expect(up.selected).toEqual(['a']);
    expect(up.steps.takeArrival('src/a.ts')).toBe('last');
  });

  it('opens a file selected any other way where it opens', () => {
    const { steps } = list('b');
    steps.step(1);
    expect(steps.takeArrival('src/a.ts')).toBeNull();
    expect(steps.takeArrival('src/c.ts')).toBe('first');
  });

  it("says which file a step went to while its diff hasn't arrived, so a press meanwhile waits for that file", () => {
    const pending: { current: PendingArrival | null } = { current: null };
    const at = (current: string) => fileSteps(['a', 'b', 'c'], current, { select: () => undefined, pathOf: (key) => `src/${key}.ts` }, pending);
    expect(at('a').steppingTo()).toBeNull();
    at('a').step(1);
    // The list moved on to b; its diff is still a's, which only shows once read and settled.
    expect(at('b').steppingTo()).toBe('src/b.ts');
    at('b').takeArrival('src/b.ts');
    expect(at('b').steppingTo()).toBeNull();
  });

  it('forgets a step once the list is on another file (picked with a click): presses then go to that one', () => {
    const pending: { current: PendingArrival | null } = { current: null };
    const at = (current: string) => fileSteps(['a', 'b', 'c'], current, { select: () => undefined, pathOf: (key) => `src/${key}.ts` }, pending);
    at('a').step(1);
    expect(at('c').steppingTo()).toBeNull();
  });

  it('selects nothing past the ends', () => {
    const { steps, selected } = list('c');
    expect(steps.canStep(1)).toBe(false);
    expect(steps.canStep(-1)).toBe(true);
    steps.step(1);
    expect(selected).toEqual([]);
    expect(steps.takeArrival('src/c.ts')).toBeNull();
  });
});
