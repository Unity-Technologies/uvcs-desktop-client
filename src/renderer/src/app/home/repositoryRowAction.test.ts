import { describe, expect, it } from 'vitest';
import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { repositoryRowActionOf } from './repositoryRowAction';

const repository = (name: string, deleted?: true): RepositorySummary => ({ id: name, name, server: 'local', owner: 'ana', spec: `${name}@local`, deleted });
const workspace = (name: string): WorkspaceSummary => ({ name, path: `/work/${name}`, guid: name });

describe('repositoryRowActionOf', () => {
  it('restores a deleted repository, whatever workspaces were known to work on it', () => {
    expect(repositoryRowActionOf(repository('Old', true), [])).toEqual({ kind: 'restore' });
    expect(repositoryRowActionOf(repository('Old', true), [workspace('old')])).toEqual({ kind: 'restore' });
  });

  it('opens the one workspace of a repository', () => {
    expect(repositoryRowActionOf(repository('Game'), [workspace('game')])).toEqual({ kind: 'open', workspace: workspace('game') });
  });

  it('offers to explore or create a workspace for a repository with none', () => {
    expect(repositoryRowActionOf(repository('Game'), [])).toEqual({ kind: 'create' });
  });

  it('offers nothing on the row of a repository with several workspaces: they show under it', () => {
    expect(repositoryRowActionOf(repository('Game'), [workspace('a'), workspace('b')])).toEqual({ kind: 'none' });
  });
});
