import { diffArrays } from 'diff';
import { describe, expect, it } from 'vitest';
import { boundedDiff, longestIncreasingPairs, type EditRun } from './boundedDiff';

/** The new ids, rebuilt from the old ones by the script: every script must do that. */
function applied(oldIds: number[], newIds: number[], runs: EditRun[]): number[] {
  const result: number[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  for (const { count, added, removed } of runs) {
    if (added) {
      result.push(...newIds.slice(newIndex, newIndex + count));
      newIndex += count;
    } else if (removed) oldIndex += count;
    else {
      expect(oldIds.slice(oldIndex, oldIndex + count)).toEqual(newIds.slice(newIndex, newIndex + count));
      result.push(...oldIds.slice(oldIndex, oldIndex + count));
      oldIndex += count;
      newIndex += count;
    }
  }
  expect(oldIndex).toBe(oldIds.length);
  return result;
}

const edits = (runs: EditRun[]) => ({
  added: runs.reduce((sum, run) => sum + (run.added ? run.count : 0), 0),
  removed: runs.reduce((sum, run) => sum + (run.removed ? run.count : 0), 0),
});

/** A deterministic pseudo-random generator, so failures reproduce. */
function random(seed: number): () => number {
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

function mutated(ids: number[], next: () => number, alphabet: number): number[] {
  const result: number[] = [];
  for (const id of ids) {
    const roll = next();
    if (roll < 0.1) continue;
    if (roll < 0.2) result.push(Math.floor(next() * alphabet));
    else result.push(id);
    if (next() < 0.1) result.push(Math.floor(next() * alphabet));
  }
  return result;
}

describe('boundedDiff', () => {
  it("gives Myers' diff, as diff computes it, when it fits in the budget", () => {
    const next = random(1);
    for (let round = 0; round < 200; round++) {
      const oldIds = Array.from({ length: Math.floor(next() * 60) }, () => Math.floor(next() * 12));
      const newIds = mutated(oldIds, next, 12);
      const myers = diffArrays(oldIds, newIds).map(({ count, added, removed }) => ({ count, added, removed }));
      expect(boundedDiff(oldIds, newIds)).toEqual(myers);
    }
  });

  it('turns the old text into the new one whatever the budget, repeated lines and all', () => {
    const next = random(2);
    for (let round = 0; round < 300; round++) {
      const alphabet = 2 + Math.floor(next() * 200);
      const oldIds = Array.from({ length: Math.floor(next() * 300) }, () => Math.floor(next() * alphabet));
      const newIds = mutated(oldIds, next, alphabet);
      for (const budget of [0, 50, 2_000]) expect(applied(oldIds, newIds, boundedDiff(oldIds, newIds, budget))).toEqual(newIds);
    }
  });

  it('keeps every line that is unique and in order, past the budget', () => {
    // Lines 0..n; every seventh changed into a line of its own.
    const oldIds = Array.from({ length: 100_000 }, (_, index) => index);
    const newIds = oldIds.map((id) => (id % 7 === 3 ? 1_000_000 + id : id));
    const started = performance.now();
    const runs = boundedDiff(oldIds, newIds);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(edits(runs)).toEqual({ added: 14_286, removed: 14_286 });
    expect(applied(oldIds, newIds, runs)).toEqual(newIds);
  });

  it('removes and adds a rewritten text whole at once', () => {
    const oldIds = Array.from({ length: 50_000 }, (_, index) => index);
    const newIds = Array.from({ length: 50_000 }, (_, index) => 50_000 + index);
    const started = performance.now();
    expect(boundedDiff(oldIds, newIds)).toEqual([
      { count: 50_000, added: false, removed: true },
      { count: 50_000, added: true, removed: false },
    ]);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('matches what it can between repeated lines once the budget is spent', () => {
    // A text of few distinct lines (blank lines, braces), reversed: no line is unique.
    const oldIds = Array.from({ length: 40_000 }, (_, index) => index % 3);
    const newIds = [...oldIds].reverse();
    const started = performance.now();
    const runs = boundedDiff(oldIds, newIds);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(applied(oldIds, newIds, runs)).toEqual(newIds);
  });
});

describe('longestIncreasingPairs', () => {
  it('keeps the longest run of pairs in order on both sides', () => {
    expect(longestIncreasingPairs([])).toEqual([]);
    expect(longestIncreasingPairs([0, 5])).toEqual([0, 5]);
    expect(longestIncreasingPairs([0, 3, 1, 1, 2, 2, 3, 0, 4, 4])).toEqual([1, 1, 2, 2, 4, 4]);
    expect(longestIncreasingPairs([0, 2, 1, 0, 2, 1])).toEqual([1, 0, 2, 1]);
  });
});
