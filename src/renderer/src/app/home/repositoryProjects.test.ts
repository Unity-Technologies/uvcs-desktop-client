import { describe, expect, it } from 'vitest';
import type { RepositorySummary } from '@shared/domain/repository';
import { matchingProjects, noRepositoriesState, projectChoices, repositoriesInProject, repositoryLabels, shownProject } from './repositoryProjects';

const SERVER = 'racing@unity';

function repository(name: string, project?: string): RepositorySummary {
  return { id: name, name, server: SERVER, owner: 'ana', spec: `${name}@${SERVER}`, ...(project ? { project } : {}) };
}

const GAME = repository('Racing/Game', 'Racing');
const ART = repository('Racing/Art', 'Racing');
const EDITOR = repository('Cloud Repositories/TextEditor', 'Cloud Repositories');
const LEGACY = repository('legacy');
const REPOSITORIES = [ART, EDITOR, GAME, LEGACY];

const unityProject = (name: string) => ({ name, guid: `guid-of-${name}` });

describe('projectChoices', () => {
  it('offers every project, empty ones too, with its repositories counted', () => {
    expect(projectChoices(['Archived', 'Cloud Repositories', 'Racing'].map(unityProject), REPOSITORIES)).toEqual([
      { name: 'Archived', guid: 'guid-of-Archived', repositoryCount: 0 },
      { name: 'Cloud Repositories', guid: 'guid-of-Cloud Repositories', repositoryCount: 1 },
      { name: 'Racing', guid: 'guid-of-Racing', repositoryCount: 2 },
    ]);
  });
});

describe('matchingProjects', () => {
  const choices = projectChoices(['Cloud Repositories', 'Racing', 'Racing Tools'].map(unityProject), REPOSITORIES);

  it('finds the projects holding every word typed, in any order and case', () => {
    expect(matchingProjects(choices, 'tools rac').map((choice) => choice.name)).toEqual(['Racing Tools']);
    expect(matchingProjects(choices, 'RACING').map((choice) => choice.name)).toEqual(['Racing', 'Racing Tools']);
  });

  it('keeps them all for a blank search', () => {
    expect(matchingProjects(choices, '  ')).toHaveLength(3);
  });
});

describe('shownProject', () => {
  it('shows the project picked while the organization has it', () => {
    expect(shownProject('Racing', [unityProject('Racing')])).toEqual(unityProject('Racing'));
  });

  it('shows all projects when none was picked or the one picked is gone', () => {
    expect(shownProject(undefined, [unityProject('Racing')])).toBeNull();
    expect(shownProject('Deleted', [unityProject('Racing')])).toBeNull();
  });
});

describe('repositoriesInProject', () => {
  it("keeps the project's repositories only, in their order", () => {
    expect(repositoriesInProject(REPOSITORIES, 'Racing')).toEqual([ART, GAME]);
    expect(repositoriesInProject(REPOSITORIES, 'Archived')).toEqual([]);
  });

  it('keeps every repository for all projects, those in none too', () => {
    expect(repositoriesInProject(REPOSITORIES, null)).toEqual(REPOSITORIES);
  });
});

describe('repositoryLabels', () => {
  it('names a repository by its own name inside the project shown, with no project', () => {
    expect(repositoryLabels(GAME, 'Racing')).toEqual({ name: 'Game' });
  });

  it('names its project apart across all projects', () => {
    expect(repositoryLabels(GAME, null)).toEqual({ name: 'Game', project: 'Racing' });
  });

  it('names the project of a repository named after it too, so every row says where it is', () => {
    expect(repositoryLabels(repository('My project (11)/My project (11)', 'My project (11)'), null)).toEqual({
      name: 'My project (11)',
      project: 'My project (11)',
    });
  });

  it('names a repository in no project by its whole name', () => {
    expect(repositoryLabels(LEGACY, null)).toEqual({ name: 'legacy' });
    expect(repositoryLabels(repository('acme/tools'), null)).toEqual({ name: 'acme/tools' });
  });
});

describe('noRepositoriesState', () => {
  it('says a search matched nothing, wherever it looked', () => {
    expect(noRepositoriesState('game', 'Racing')).toEqual({ title: 'No matching repositories' });
  });

  it('says the project picked has none yet', () => {
    expect(noRepositoriesState('', 'Archived')).toEqual({ title: 'No repositories in Archived yet', description: 'Create one to start versioning a project.' });
  });

  it('says the server has none yet', () => {
    expect(noRepositoriesState('', null).title).toBe('No repositories yet');
  });
});
