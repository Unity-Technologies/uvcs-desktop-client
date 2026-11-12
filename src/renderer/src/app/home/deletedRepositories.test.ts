import { describe, expect, it } from 'vitest';
import type { RepositorySummary } from '@shared/domain/repository';
import { deletedRepositoriesTip, repositoriesShown, repositoryRestore } from './deletedRepositories';

const live = (name: string): RepositorySummary => ({ id: name, name, server: 'acme@cloud', owner: 'ana', spec: `${name}@acme@cloud` });
const deleted = (name: string, guid: string, project?: string): RepositorySummary => ({
  id: guid,
  name,
  server: 'acme@cloud',
  owner: 'ana',
  spec: `${guid}@acme@cloud`,
  deleted: true,
  ...(project ? { project } : {}),
});

const shownAs = (repositories: RepositorySummary[]): string[] => repositories.map((repository) => `${repository.name}${repository.deleted ? ' (deleted)' : ''}`);

describe('repositoriesShown', () => {
  const liveOnes = [live('game'), live('tools')];
  const deletedOnes = [deleted('art', 'g1'), deleted('tools', 'g2')];

  it('shows only the live repositories while the option is off', () => {
    expect(shownAs(repositoriesShown(liveOnes, deletedOnes, false))).toEqual(['game', 'tools']);
  });

  it('shows the deleted ones among the live ones by name, a live one first when they share it', () => {
    expect(shownAs(repositoriesShown(liveOnes, deletedOnes, true))).toEqual(['art (deleted)', 'game', 'tools', 'tools (deleted)']);
  });

  it('shows the live ones as listed when no repository is deleted', () => {
    expect(repositoriesShown(liveOnes, [], true)).toEqual(liveOnes);
  });
});

describe('repositoryRestore', () => {
  it("asks for a new name only when a live repository has the deleted one's name, exactly", () => {
    expect(repositoryRestore(deleted('tools', 'g2'), ['game', 'tools']).needsNewName).toBe(true);
    expect(repositoryRestore(deleted('art', 'g1'), ['game', 'tools']).needsNewName).toBe(false);
  });

  it('takes the new name typed, trimmed, and tells one a live repository has', () => {
    const restore = repositoryRestore(deleted('tools', 'g2'), ['game', 'tools']);
    expect(restore.newName('  tools-old ')).toBe('tools-old');
    expect(restore.isTaken('tools')).toBe(true);
    expect(restore.isTaken('game')).toBe(true);
    expect(restore.isTaken('tools-old')).toBe(false);
  });

  it("names one inside its Unity project as its row does, and restores it there", () => {
    const restore = repositoryRestore(deleted('Racing/Game', 'g3', 'Racing'), ['Racing/Game', 'Racing/Tools']);
    expect(restore.initialName).toBe('Game');
    expect(restore.newName('Game2')).toBe('Racing/Game2');
    expect(restore.isTaken('Tools')).toBe(true);
  });
});

describe('deletedRepositoriesTip', () => {
  it('tells the 7 days Unity Cloud keeps them, and none on a server of its own', () => {
    expect(deletedRepositoriesTip('acme@cloud')).toContain('7 days');
    expect(deletedRepositoriesTip('acme@unity')).toContain('7 days');
    expect(deletedRepositoriesTip('local')).not.toContain('7 days');
  });
});
