import { describe, expect, it } from 'vitest';
import { workspaceRootItem } from './workspaceRoot';

const workspace = { path: '/w/game', repository: 'game@local' };

describe('workspaceRootItem', () => {
  it("names a shelve's root by the shelve, as cm ls lists it", () => {
    const root = workspaceRootItem({ ...workspace, selector: { kind: 'shelve', name: '7' }, loadedChangeset: null });
    expect(root.shelveId).toBe(7);
  });

  it('names no shelve for a partial workspace on a branch, which loaded no one changeset either', () => {
    const root = workspaceRootItem({ ...workspace, selector: { kind: 'branch', name: '/main' }, loadedChangeset: null });
    expect(root).not.toHaveProperty('shelveId');
    expect(root.branch).toBe('/main');
  });
});
