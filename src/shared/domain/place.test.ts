import { describe, expect, it } from 'vitest';
import { placeId, repositoryPlace, workspacePathOf, workspacePlace } from './place';

describe('workspacePathOf', () => {
  it("is the workspace's path, and none for a repository explored without a workspace", () => {
    expect(workspacePathOf(workspacePlace('/wk/game'))).toBe('/wk/game');
    expect(workspacePathOf(repositoryPlace('game@local'))).toBeNull();
  });
});

describe('placeId', () => {
  it('keeps a workspace and a repository apart, on every OS', () => {
    expect(placeId(workspacePlace('/wk/game'))).toBe('/wk/game');
    expect(placeId(workspacePlace('C:\\wk\\game'))).toBe('C:\\wk\\game');
    expect(placeId(repositoryPlace('game@local'))).toBe('repository:game@local');
  });
});
