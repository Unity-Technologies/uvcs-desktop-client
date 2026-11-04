import { describe, expect, it } from 'vitest';
import { adjacentKey, fileSteps, pendingArrival, settlingOnOf } from './fileSteps';

describe('settlingOnOf', () => {
  const a = { path: 'src/a.ts' };
  const b = { path: 'src/b.ts' };

  it("names the file selected while the view beside the list still diffs another (Changes' settle)", () => {
    expect(settlingOnOf(b, a)).toBe('src/b.ts');
    expect(settlingOnOf(b, undefined)).toBe('src/b.ts');
  });

  it('names none once the view diffs the file selected, the same item', () => {
    expect(settlingOnOf(b, b)).toBeNull();
  });

  it('names none with no file selected: a group, a folder the list draws for a path', () => {
    expect(settlingOnOf(undefined, a)).toBeNull();
  });
});

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

/** A list that selects at once, telling the step so. */
const SELECTS = (_key: string, selected: () => void): void => selected();

describe('fileSteps', () => {
  const list = (current: string) => {
    const selected: string[] = [];
    const pending = pendingArrival();
    const steps = fileSteps(['a', 'b', 'c'], current, { select: (key, done) => {
      done();
      selected.push(key);
    }, pathOf: (key) => `src/${key}.ts` }, pending);
    return { steps, selected };
  };

  it('says where a step went, for the presses left for this file to follow it', () => {
    expect(list('b').steps.step(1)).toBe('src/c.ts');
    expect(list('c').steps.step(1)).toBeNull();
  });

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
    const pending = pendingArrival();
    const at = (current: string) => fileSteps(['a', 'b', 'c'], current, { select: SELECTS, pathOf: (key) => `src/${key}.ts` }, pending);
    expect(at('a').steppingTo()).toBeNull();
    at('a').step(1);
    // The list moved on to b; its diff is still a's, which only shows once read and settled.
    expect(at('b').steppingTo()).toBe('src/b.ts');
    at('b').takeArrival('src/b.ts');
    expect(at('b').steppingTo()).toBeNull();
  });

  it('says so too before the list rendered on the file stepped to: a press then still sees the list on the previous one', () => {
    const pending = pendingArrival();
    const at = (current: string) => fileSteps(['a', 'b', 'c'], current, { select: SELECTS, pathOf: (key) => `src/${key}.ts` }, pending);
    at('a').step(1);
    expect(at('a').steppingTo()).toBe('src/b.ts');
  });

  it('forgets where the step came from once the list rendered on the file it went to: a click back there is a pick', () => {
    const pending = pendingArrival();
    const at = (current: string) => fileSteps(['a', 'b', 'c'], current, { select: SELECTS, pathOf: (key) => `src/${key}.ts` }, pending);
    at('a').step(1);
    at('b').listMoved();
    expect(at('a').steppingTo()).toBeNull();
  });

  it('forgets a step once the list is on another file (picked with a click): presses then go to that one', () => {
    const pending = pendingArrival();
    const at = (current: string) => fileSteps(['a', 'b', 'c'], current, { select: SELECTS, pathOf: (key) => `src/${key}.ts` }, pending);
    at('a').step(1);
    expect(at('c').steppingTo()).toBeNull();
  });

  it("leaves no step in flight where the list didn't select (unsaved edits kept: Cancel), so presses go on in this file", () => {
    const pending = pendingArrival();
    const at = (current: string) => fileSteps(['a', 'b', 'c'], current, { select: () => undefined, pathOf: (key) => `src/${key}.ts` }, pending);
    expect(at('a').step(1)).toBeNull();
    expect(at('a').steppingTo()).toBeNull();
    expect(at('a').takeArrival('src/b.ts')).toBeNull();
  });

  it('records the step once the list selects, after asking about unsaved edits', () => {
    const pending = pendingArrival();
    let leave = (): void => undefined;
    const at = (current: string) => fileSteps(['a', 'b', 'c'], current, { select: (_key, selected) => void (leave = selected), pathOf: (key) => `src/${key}.ts` }, pending);
    at('a').step(1);
    expect(at('a').steppingTo()).toBeNull();
    leave();
    expect(at('b').steppingTo()).toBe('src/b.ts');
    expect(at('b').takeArrival('src/b.ts')).toBe('first');
  });

  it('forgets a step once the list rendered on a file neither it went to nor came from', () => {
    const pending = pendingArrival();
    const at = (current: string) => fileSteps(['a', 'b', 'c'], current, { select: SELECTS, pathOf: (key) => `src/${key}.ts` }, pending);
    at('a').step(1);
    at('c').listMoved();
    expect(at('b').steppingTo()).toBeNull();
    expect(at('b').takeArrival('src/b.ts')).toBeNull();
  });

  it("says which file the list is on while the view beside it still shows another, as the host says (Changes' settle)", () => {
    const list = { select: SELECTS, pathOf: (key: string) => `src/${key}.ts` };
    expect(fileSteps(['a', 'b'], 'b', { ...list, settlingOn: 'src/b.ts' }, pendingArrival()).settlingOn).toBe('src/b.ts');
    expect(fileSteps(['a', 'b'], 'b', list, pendingArrival()).settlingOn).toBeNull();
  });

  it('selects nothing past the ends', () => {
    const { steps, selected } = list('c');
    expect(steps.canStep(1)).toBe(false);
    expect(steps.canStep(-1)).toBe(true);
    steps.step(1);
    expect(selected).toEqual([]);
    expect(steps.takeArrival('src/c.ts')).toBeNull();
  });

  it("hands the presses left for a diff on to the conflict a step from it went to, the lists of one view sharing them (Incoming's)", () => {
    const pending = pendingArrival();
    const path = (key: string) => `src/${key}.ts`;
    const diffs = fileSteps(['a', 'b'], 'a', { select: SELECTS, pathOf: path }, pending);
    diffs.kept.push('src/a.ts', -1);
    diffs.kept.retag('src/a.ts', diffs.step(1)!);
    // The conflict's view, with no diff header of its own, takes them from its list.
    const conflicts = fileSteps(['b'], 'b', { select: SELECTS, pathOf: path }, pending);
    expect([conflicts.kept.take('src/b.ts'), conflicts.kept.take('src/b.ts')]).toEqual([-1, undefined]);
  });

  it('drops the presses kept for files the list left as it moves, keeping those of the file it is on', () => {
    const pending = pendingArrival();
    pending.kept.push('src/a.ts', 1);
    pending.kept.push('src/b.ts', -1);
    fileSteps(['a', 'b', 'c'], 'b', { select: SELECTS, pathOf: (key) => `src/${key}.ts` }, pending).listMoved();
    expect([pending.kept.take('src/a.ts'), pending.kept.take('src/b.ts')]).toEqual([undefined, -1]);
  });
});
