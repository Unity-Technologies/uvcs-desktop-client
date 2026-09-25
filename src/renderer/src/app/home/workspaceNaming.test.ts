import { describe, expect, it } from 'vitest';
import { suggestWorkspaceName } from './workspaceNaming';

describe('suggestWorkspaceName', () => {
  it('uses the last segment of sub-repository names', () => {
    expect(suggestWorkspaceName('codice/unitymerge', [])).toBe('unitymerge');
  });

  it('adds a numeric suffix when the name is taken', () => {
    expect(suggestWorkspaceName('game', ['Game', 'game-2'])).toBe('game-3');
  });
});
