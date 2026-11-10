import { describe, expect, it } from 'vitest';
import { workspaceRootItem } from './workspaceRoot';

const workspace = { path: '/work/game', repository: 'game@local' };

describe('workspaceRootItem', () => {
  it("is a shelve's root on a shelve, as `cm ls` lists it", () => {
    const root = workspaceRootItem({ ...workspace, selector: { kind: 'shelve', name: '3' }, loadedChangeset: null });
    expect(root.shelveId).toBe(3);
  });

  it('is no shelve in a partial workspace, which has no changeset loaded either', () => {
    const root = workspaceRootItem({ ...workspace, selector: { kind: 'branch', name: '/main' }, loadedChangeset: null });
    expect(root).not.toHaveProperty('shelveId');
    expect(root).toMatchObject({ changeset: null, branch: '/main' });
  });
});
