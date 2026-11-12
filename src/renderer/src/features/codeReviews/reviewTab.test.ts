import { describe, expect, it } from 'vitest';
import { changesFocusAskedFor, changesFocusRequest, conversationFocus, mountedTabs, openingTab, pageAfterOpenPick, reviewTabShown } from './reviewTab';

describe('reviewTabShown', () => {
  it('shows the tab the page opens on and hides the other, which keeps its keys off', () => {
    expect([reviewTabShown({}, 'conversation'), reviewTabShown({}, 'changes')]).toEqual([true, false]);
    expect([reviewTabShown({ focusPath: 'src/a.cs' }, 'conversation'), reviewTabShown({ focusPath: 'src/a.cs' }, 'changes')]).toEqual([false, true]);
  });
});

describe('openingTab', () => {
  it('opens on the conversation, or on the changes when a link names a file', () => {
    expect(openingTab({})).toBe('conversation');
    expect(openingTab({ focusPath: 'src/a.cs' })).toBe('changes');
  });

  it('opens on the tab the page names', () => {
    expect(openingTab({ tab: 'conversation', focusPath: 'src/a.cs' })).toBe('conversation');
    expect(openingTab({ tab: 'changes' })).toBe('changes');
  });
});

describe('mountedTabs', () => {
  it('keeps every tab shown so far mounted, so going back to one finds it as it was left', () => {
    expect(mountedTabs([], 'conversation')).toEqual(['conversation']);
    expect(mountedTabs(['conversation'], 'changes')).toEqual(['conversation', 'changes']);
    expect(mountedTabs(['conversation', 'changes'], 'conversation')).toEqual(['conversation', 'changes']);
  });

  it('gives the same list back when the tab is already mounted, so nothing renders again for it', () => {
    const mounted = ['conversation'] as const;
    expect(mountedTabs(mounted, 'conversation')).toBe(mounted);
  });
});

describe('conversationFocus', () => {
  it("is the thread the page goes to in the conversation, never one it goes to in the changes", () => {
    // A comment's file gone to from the conversation names its thread for the changes; the conversation, kept mounted
    // and hidden, scrolled to it too, and going back to its tab found it moved.
    expect(conversationFocus({ tab: 'conversation', focusThread: 47 })).toBe(47);
    expect(conversationFocus({ tab: 'changes', focusPath: 'Assets/Retry.cs', focusThread: 47 })).toBeUndefined();
    expect(conversationFocus({ focusPath: 'Assets/Retry.cs', focusThread: 47 })).toBeUndefined();
  });
});

describe('changesFocusAskedFor', () => {
  it("is the thread a page moved to asks the changes for: a comment's file gone to from the conversation, on the page shown", () => {
    // The page moves in place now (`movesWithinTop`): the changes, mounted already, went on showing the file they were on.
    const shown = { tab: 'changes', focusPath: 'Assets/Commands.cs' } as const;
    const moved = { tab: 'changes', focusPath: 'Assets/Retry.cs', focusThread: 51 } as const;
    expect(changesFocusAskedFor(shown, moved)).toEqual({ threadId: 51 });
  });

  it("is the changeset a page moved to asks for: a check-in gone to from the conversation", () => {
    expect(changesFocusAskedFor({ tab: 'conversation' }, { tab: 'changes', focusChangeset: 15 })).toEqual({ changesetId: 15 });
  });

  it('is the changeset, the file and the thread together: a change request shown where it was applied', () => {
    const shown = { tab: 'conversation' } as const;
    const moved = { tab: 'changes', focusChangeset: 15, focusPath: 'Assets/Waves/WaveSpawner.cs', focusThread: 52 } as const;
    expect(changesFocusAskedFor(shown, moved)).toEqual({ threadId: 52, changesetId: 15 });
  });

  it("is the span a page moved to asks for: what's new since the user's review", () => {
    expect(changesFocusAskedFor({ tab: 'conversation' }, { tab: 'changes', focusChangesets: { oldest: 15, newest: 17 } })).toEqual({ changesets: { oldest: 15, newest: 17 } });
  });

  it('asks nothing of a page unchanged, of a tab picked, or of a thread gone to in the conversation', () => {
    const moved = { tab: 'changes', focusPath: 'Assets/Retry.cs', focusThread: 51 } as const;
    expect(changesFocusAskedFor(moved, moved)).toBeUndefined();
    expect(changesFocusAskedFor(moved, { tab: 'changes' })).toBeUndefined();
    expect(changesFocusAskedFor(moved, { tab: 'conversation', focusThread: 51 })).toBeUndefined();
    expect(changesFocusAskedFor(moved, { tab: 'conversation', focusChangeset: 15 })).toBeUndefined();
  });
});

describe('changesFocusRequest', () => {
  it('asks the diff for the changeset, changeset by changeset, without a file', () => {
    expect(changesFocusRequest({ changesetId: 15 }, 4)).toEqual({ changesetId: 15, seq: 4 });
  });

  it('asks the diff for the span, changeset by changeset', () => {
    expect(changesFocusRequest({ changesets: { oldest: 15, newest: 17 } }, 5)).toEqual({ changesets: { oldest: 15, newest: 17 }, seq: 5 });
  });
});

describe('pageAfterOpenPick', () => {
  it('forgets the thread the conversation was opened at, so going to it again reaches the conversation', () => {
    expect(pageAfterOpenPick({ kind: 'codeReview', reviewId: 41, tab: 'conversation', focusThread: 7 })).toEqual({ kind: 'codeReview', reviewId: 41, tab: 'conversation', focusThread: undefined });
  });

  it('leaves the page as it is when the conversation names no thread', () => {
    const page = { kind: 'codeReview', reviewId: 41, tab: 'conversation' } as const;
    expect(pageAfterOpenPick(page)).toBe(page);
  });
});
