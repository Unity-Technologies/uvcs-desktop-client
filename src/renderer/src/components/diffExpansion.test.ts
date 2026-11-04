import { describe, expect, it } from 'vitest';
import {
  collapsesWithHost,
  escapeBackToList,
  escapeCollapsesDiff,
  expandDiffWords,
  expandedAfterToggle,
  focusGoesToDiff,
  leavesExpandedDiff,
  shortcutWhileExpanded,
  type EscapePress,
} from './diffExpansion';

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

describe('focusGoesToDiff', () => {
  const held = { onBody: false, visible: true, onExpandButton: false };

  it('gives the keyboard to the diff from nowhere, or from a list that went out of sight with the files', () => {
    expect(focusGoesToDiff({ ...held, onBody: true, visible: false })).toBe(true);
    expect(focusGoesToDiff({ ...held, visible: false })).toBe(true);
  });

  it('takes it from the Expand button pressed with the mouse, so Esc drops a picked change before collapsing', () => {
    expect(focusGoesToDiff({ ...held, onExpandButton: true })).toBe(true);
  });

  it('leaves it where it still shows (the code itself, a field)', () => {
    expect(focusGoesToDiff(held)).toBe(false);
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
  const esc: EscapePress = { isEscape: true, defaultPrevented: false, keyboardTaken: false, mayRun: true, commandClaims: false };

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

  it("leaves Esc to a command bound to it, whichever listens first: a pending cut in Files is cancelled before the diff collapses", () => {
    expect(escapeCollapsesDiff(true, { ...esc, commandClaims: true })).toBe(false);
  });
});

describe('escapeBackToList', () => {
  const esc = { isEscape: true, defaultPrevented: false, keyboardTaken: false };

  it("takes the keyboard from a diff back to its list (History's revisions, Files' tree)", () => {
    expect(escapeBackToList(false, esc)).toBe(true);
  });

  it('gives way while the diff is expanded: the list is out of sight, and Esc collapses the diff instead', () => {
    expect(escapeBackToList(true, esc)).toBe(false);
  });

  it('leaves Esc to what took it first, or to what holds the keyboard', () => {
    expect(escapeBackToList(false, { ...esc, defaultPrevented: true })).toBe(false);
    expect(escapeBackToList(false, { ...esc, keyboardTaken: true })).toBe(false);
    expect(escapeBackToList(false, { ...esc, isEscape: false })).toBe(false);
  });
});

describe('shortcutWhileExpanded', () => {
  it('collapses before checking in: the summary and what is checked in show, and an empty summary takes the caret', () => {
    expect(shortcutWhileExpanded('checkin')).toBe('collapseFirst');
  });

  it('only collapses for Toggle Sidebar: the sidebar the user asked for comes back as it was', () => {
    expect(shortcutWhileExpanded('toggleSidebar')).toBe('collapseOnly');
  });

  it("lets Go to file act expanded: the file picked shows in the diff, as choosing another file does", () => {
    expect(shortcutWhileExpanded('filesGoToFile')).toBe('acts');
    expect(shortcutWhileExpanded('goToFile')).toBe('acts');
  });
});

describe('collapsesWithHost', () => {
  it('ends the mode once its view settles with nothing to diff: nothing pending after a check-in, Incoming up to date', () => {
    expect(collapsesWithHost(true, 'none')).toBe(true);
  });

  it('keeps it while the view reads (the next changeset, a followed selection) or has diffs', () => {
    expect(collapsesWithHost(true, 'reading')).toBe(false);
    expect(collapsesWithHost(true, 'some')).toBe(false);
  });

  it('has nothing to end while no diff is expanded', () => {
    expect(collapsesWithHost(false, 'none')).toBe(false);
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
