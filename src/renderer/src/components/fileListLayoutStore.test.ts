import { describe, expect, it } from 'vitest';
import { layoutFromPendingChangesView } from './fileListLayoutStore';

describe('layoutFromPendingChangesView', () => {
  it('starts from the layout the Changes view kept when it had its own', () => {
    expect(layoutFromPendingChangesView(JSON.stringify({ state: { layout: 'tree', grouping: 'none' }, version: 1 }))).toBe('tree');
    expect(layoutFromPendingChangesView(JSON.stringify({ state: { layout: 'list' }, version: 1 }))).toBe('list');
  });

  it('starts as a list when nothing was kept, or what was kept is not a layout', () => {
    expect(layoutFromPendingChangesView(null)).toBe('list');
    expect(layoutFromPendingChangesView(JSON.stringify({ state: { grouping: 'changelist' } }))).toBe('list');
    expect(layoutFromPendingChangesView(JSON.stringify({ state: { layout: 'grid' } }))).toBe('list');
    expect(layoutFromPendingChangesView('{not json')).toBe('list');
  });
});
