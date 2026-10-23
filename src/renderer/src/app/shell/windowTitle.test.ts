import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { placeName, repositoryWindowTitle } from './windowTitle';

describe('repositoryWindowTitle', () => {
  it('names the repository and its server as the home screen does', () => {
    expect(repositoryWindowTitle('game@local')).toBe('game — This computer');
    expect(repositoryWindowTitle('game@localhost:8087')).toBe('game — localhost:8087');
  });
});

describe('placeName', () => {
  it("is a workspace's name once read, and a repository's own", () => {
    expect(placeName(workspacePlace('/wk/game'), { name: 'game-wk' })).toBe('game-wk');
    expect(placeName(workspacePlace('/wk/game'), undefined)).toBeUndefined();
    expect(placeName(repositoryPlace('game@acme@cloud'), undefined)).toBe('game');
  });
});
