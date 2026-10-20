import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';

import { VIEWS, viewDefinition } from './viewRegistry';

const LAZY = Symbol.for('react.lazy');

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

  it('paints Changes, where a workspace opens, as its own loading state: never a generic fallback it then replaces', () => {
    const changes = viewDefinition('changes').component;
    const others = VIEWS.filter((view) => view.id !== 'changes').map((view) => view.component);

    expect('$$typeof' in changes && changes.$$typeof === LAZY).toBe(false);
    expect(others.every((component) => '$$typeof' in component && component.$$typeof === LAZY)).toBe(true);
  });
});
