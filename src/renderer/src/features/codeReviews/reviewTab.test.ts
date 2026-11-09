import { describe, expect, it } from 'vitest';
import { conversationFocus, mountedTabs, openingTab } from './reviewTab';

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
