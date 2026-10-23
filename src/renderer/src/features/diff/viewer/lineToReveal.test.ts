import { describe, expect, it } from 'vitest';
import { lineToReveal } from './lineToReveal';

/**
 * A diff of a 60-line file: lines 2–8 (with their context) became 2–10, two lines added; lines 40–46 became 42–48.
 * Between them, and before and after, unchanged lines a collapsed diff folds away.
 */
const HUNKS = [
  { deletionStart: 2, deletionCount: 7, additionStart: 2, additionCount: 9 },
  { deletionStart: 40, deletionCount: 7, additionStart: 42, additionCount: 7 },
];

describe('lineToReveal', () => {
  it("is the newer side's line itself, which Pierre unfolds (`revealLine`)", () => {
    expect(lineToReveal(HUNKS, 'additions', 25)).toBe(25);
  });

  it("is, for an older side's unchanged line, the same line on the newer side: a folded region holds the same lines on both", () => {
    // Before the first change.
    expect(lineToReveal(HUNKS, 'deletions', 1)).toBe(1);
    // Between two changes, past the two lines the first one added.
    expect(lineToReveal(HUNKS, 'deletions', 9)).toBe(11);
    expect(lineToReveal(HUNKS, 'deletions', 20)).toBe(22);
    expect(lineToReveal(HUNKS, 'deletions', 39)).toBe(41);
    // After the last change.
    expect(lineToReveal(HUNKS, 'deletions', 47)).toBe(49);
    expect(lineToReveal(HUNKS, 'deletions', 58)).toBe(60);
  });

  it("is none for an older side's line in a change, which is never folded", () => {
    expect(lineToReveal(HUNKS, 'deletions', 5)).toBeNull();
    expect(lineToReveal(HUNKS, 'deletions', 46)).toBeNull();
  });

  it('counts a change that only adds lines as taking none of the older side', () => {
    // Two lines added after old line 10, shown with three lines of context on each side: old 8–13, new 8–15.
    const added = [{ deletionStart: 8, deletionCount: 6, additionStart: 8, additionCount: 8 }];
    expect(lineToReveal(added, 'deletions', 30)).toBe(32);
    const bare = [{ deletionStart: 10, deletionCount: 0, additionStart: 11, additionCount: 2 }];
    expect(lineToReveal(bare, 'deletions', 4)).toBe(4);
    expect(lineToReveal(bare, 'deletions', 11)).toBe(13);
  });

  it('is the same line on both sides of a diff with no changes', () => {
    expect(lineToReveal([], 'deletions', 12)).toBe(12);
  });
});
