import { describe, expect, it } from 'vitest';
import { escapeCollapsesDiff, expandableDiffInFront, expandDiffWords, expandedAfterToggle, leavesExpandedDiff, type EscapePress } from './diffExpansion';

describe('leavesExpandedDiff', () => {
  const changes = { view: 'changes', depth: 0 };

  it('keeps the diff expanded while the navigation stays where it was: choosing another file changes none of it', () => {
    expect(leavesExpandedDiff(changes, { view: 'changes', depth: 0 })).toBe(false);
  });

  it('ends it on another view', () => {
    expect(leavesExpandedDiff(changes, { view: 'branches', depth: 0 })).toBe(true);
  });

  it('ends it on a page opened over the diff, and on going back from the page that showed it', () => {
    expect(leavesExpandedDiff(changes, { view: 'changes', depth: 1 })).toBe(true);
    expect(leavesExpandedDiff({ view: 'changesets', depth: 1 }, { view: 'changesets', depth: 0 })).toBe(true);
  });

  it('keeps it when a page is replaced at the same depth, as a page window following the selection does', () => {
    expect(leavesExpandedDiff({ view: 'changes', depth: 1 }, { view: 'changes', depth: 1 })).toBe(false);
  });
});

describe('expandableDiffInFront', () => {
  const shown = { element: 'diff of the page in front' };
  const underPage = { element: 'diff of the view under the page' };
  const inFront = (element: string): boolean => element === shown.element;

  it('finds a diff only where it is in front, not in a view hidden under a page', () => {
    expect(expandableDiffInFront([underPage, shown], inFront)).toBe(true);
    expect(expandableDiffInFront([underPage], inFront)).toBe(false);
  });

  it('finds none with no diff on screen', () => {
    expect(expandableDiffInFront([], inFront)).toBe(false);
  });
});

describe('expandedAfterToggle', () => {
  it('expands the diff in front', () => {
    expect(expandedAfterToggle(false, true)).toBe(true);
  });

  it('does nothing with no diff in front to expand', () => {
    expect(expandedAfterToggle(false, false)).toBe(false);
  });

  it('collapses an expanded diff, whatever is in front', () => {
    expect(expandedAfterToggle(true, true)).toBe(false);
    expect(expandedAfterToggle(true, false)).toBe(false);
  });
});

describe('escapeCollapsesDiff', () => {
  const esc: EscapePress = { isEscape: true, defaultPrevented: false, keyboardTaken: false, mayRun: true };

  it('collapses the expanded diff on Esc nothing else took', () => {
    expect(escapeCollapsesDiff(true, esc)).toBe(true);
  });

  it('does nothing while no diff is expanded, or for another key', () => {
    expect(escapeCollapsesDiff(false, esc)).toBe(false);
    expect(escapeCollapsesDiff(true, { ...esc, isEscape: false })).toBe(false);
  });

  it('leaves Esc to what claimed it first: a menu closing, picked lines dropped, the editor leaving the text', () => {
    expect(escapeCollapsesDiff(true, { ...esc, defaultPrevented: true })).toBe(false);
  });

  it('leaves Esc to a field typed into, the palette, a dialog or a menu holding the keyboard', () => {
    expect(escapeCollapsesDiff(true, { ...esc, keyboardTaken: true })).toBe(false);
  });

  it('waits behind a modal dialog and runs once per press', () => {
    expect(escapeCollapsesDiff(true, { ...esc, mayRun: false })).toBe(false);
  });
});

describe('expandDiffWords', () => {
  it('says how to leave before expanding, in the keys of the OS', () => {
    expect(expandDiffWords(false, 'Esc')).toEqual({ label: 'Expand diff', hint: 'Esc to collapse' });
  });

  it('names what pressing it again does once expanded', () => {
    expect(expandDiffWords(true, 'Esc')).toEqual({ label: 'Collapse diff' });
  });
});
