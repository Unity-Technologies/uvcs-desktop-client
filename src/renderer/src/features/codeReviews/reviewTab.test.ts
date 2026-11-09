import { describe, expect, it } from 'vitest';
import { openingTab } from './reviewTab';

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
