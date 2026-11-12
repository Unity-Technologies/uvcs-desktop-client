import { describe, expect, it } from 'vitest';
import type { RepositorySummary } from '@shared/domain/repository';
import { repositoriesShown, restoreNeedsNewName } from './deletedRepositories';

const live = (name: string): RepositorySummary => ({ id: name, name, server: 'acme@cloud', owner: 'ana', spec: `${name}@acme@cloud` });
const deleted = (name: string, guid: string): RepositorySummary => ({ id: guid, name, server: 'acme@cloud', owner: 'ana', spec: `${guid}@acme@cloud`, deleted: true });

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

describe('restoreNeedsNewName', () => {
  it('asks for a new name only when a live repository has the deleted one\'s name, ', () => {
    expect(restoreNeedsNewName(deleted('tools', 'g2'), ['game', 'tools'])).toBe(true);
    expect(restoreNeedsNewName(deleted('art', 'g1'), ['game', 'tools'])).toBe(false);
  });
});
