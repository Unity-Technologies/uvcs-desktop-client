import { describe, expect, it, vi } from 'vitest';

await vi.hoisted(async () => (await import('../../lib/testing/fakeWindow')).installFakeWindow('darwin'));

import { VIEWS } from './viewRegistry';

describe('views', () => {
  it('keeps each sidebar group together, so ⌘1… follow the order the sidebar shows them in', () => {
    const groups = VIEWS.map((view) => view.group).filter((group, index, all) => group !== all[index - 1]);

    expect(groups).toEqual(['Workspace', 'History', 'Collaborate']);
  });

  it('gives each view its own shortcut, in sidebar order', () => {
    expect(VIEWS.slice(0, 3).map((view) => [view.id, view.shortcut])).toEqual([
      ['changes', 'mod+1'],
      ['incoming', 'mod+2'],
      ['files', 'mod+3'],
    ]);
    expect(new Set(VIEWS.map((view) => view.shortcut)).size).toBe(VIEWS.length);
  });
});
