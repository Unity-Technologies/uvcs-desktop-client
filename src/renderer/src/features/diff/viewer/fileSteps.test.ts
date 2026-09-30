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

  it('selects nothing past the ends', () => {
    const { steps, selected } = list('c');
    expect(steps.canStep(1)).toBe(false);
    expect(steps.canStep(-1)).toBe(true);
    steps.step(1);
    expect(selected).toEqual([]);
    expect(steps.takeArrival('src/c.ts')).toBeNull();
  });
});
