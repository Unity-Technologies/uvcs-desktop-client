import { describe, expect, it } from 'vitest';
import type { RepositorySummary } from '@shared/domain/repository';
import { parseProjectGuid } from '@shared/domain/stableIds';
import { projectGuidFor } from '@shared/testing/stableIdsFor';
import { homeProjectKept, homeProjectOfLink, matchingProjects, movedHomeProject, noRepositoriesState, projectChoices, repositoriesInProject, repositoryLabels, shownProject } from './repositoryProjects';

const SERVER = 'racing@unity';

function repository(name: string, project?: string): RepositorySummary {
  return { id: name, name, server: SERVER, owner: 'ana', spec: `${name}@${SERVER}`, ...(project ? { project } : {}) };
}

const GAME = repository('Racing/Game', 'Racing');
const ART = repository('Racing/Art', 'Racing');
const EDITOR = repository('Cloud Repositories/TextEditor', 'Cloud Repositories');
const LEGACY = repository('legacy');
const REPOSITORIES = [ART, EDITOR, GAME, LEGACY];

const unityProject = (name: string, index: number) => ({ name, guid: projectGuidFor(index + 1) });

const RACING_GUID = parseProjectGuid('5a1c2d3e-0000-4000-8000-00000000abcd')!;
const KART_GUID = parseProjectGuid('7b2d3e4f-0000-4000-8000-00000000ef01')!;
const RACING = { name: 'Racing', guid: RACING_GUID };
const KART = { name: 'Kart', guid: KART_GUID };

describe('projectChoices', () => {
  it('offers every project, empty ones too, with its repositories counted', () => {
    expect(projectChoices(['Archived', 'Cloud Repositories', 'Racing'].map(unityProject), REPOSITORIES)).toEqual([
      { name: 'Archived', guid: projectGuidFor(1), repositoryCount: 0 },
      { name: 'Cloud Repositories', guid: projectGuidFor(2), repositoryCount: 1 },
      { name: 'Racing', guid: projectGuidFor(3), repositoryCount: 2 },
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
  it('shows the project picked by its GUID, under whatever name it has now, as cm prints it in any case', () => {
    expect(shownProject(RACING_GUID, [RACING, KART])).toEqual(RACING);
    expect(shownProject(RACING_GUID, [{ name: 'Racing Renamed', guid: RACING_GUID }])).toEqual({ name: 'Racing Renamed', guid: RACING_GUID });
    expect(shownProject(RACING_GUID.toUpperCase(), [RACING])).toEqual(RACING);
  });

  it('shows a project kept by its name before, until it moves to its GUID', () => {
    expect(shownProject('Racing', [RACING, KART])).toEqual(RACING);
  });

  it('shows all projects when none was picked or the one picked is gone', () => {
    expect(shownProject(undefined, [RACING])).toBeNull();
    expect(shownProject('Deleted', [RACING])).toBeNull();
    expect(shownProject(KART_GUID, [RACING])).toBeNull();
  });

  it("never takes a project named like another's GUID for it", () => {
    expect(shownProject(RACING_GUID, [{ name: RACING_GUID, guid: KART_GUID }])).toBeNull();
  });
});

describe('homeProjectKept', () => {
  it("keeps a project by its GUID, by its name only from a cm that printed none, and nothing for all projects", () => {
    expect(homeProjectKept(RACING)).toBe(RACING_GUID);
    expect(homeProjectKept({ name: 'Racing' })).toBe('Racing');
    expect(homeProjectKept(null)).toBeNull();
  });
});

describe('homeProjectOfLink', () => {
  it("keeps the project a link names by its GUID once the organization's listing is read", () => {
    expect(homeProjectOfLink('Racing', [RACING, KART])).toBe(RACING_GUID);
  });

  it('keeps its name until then, or when the listing holds no such project', () => {
    expect(homeProjectOfLink('Racing', undefined)).toBe('Racing');
    expect(homeProjectOfLink('Racing', [KART])).toBe('Racing');
  });

  it('keeps nothing for a link to every project', () => {
    expect(homeProjectOfLink(null, [RACING])).toBeNull();
  });
});

describe('movedHomeProject', () => {
  it('moves a project kept by name to its GUID once the listing holds it', () => {
    expect(movedHomeProject('Racing', [KART, RACING])).toBe(RACING_GUID);
  });

  it('moves nothing kept by GUID already, nothing picked, a project gone, or one listed with no GUID', () => {
    expect(movedHomeProject(RACING_GUID, [RACING])).toBeUndefined();
    expect(movedHomeProject(undefined, [RACING])).toBeUndefined();
    expect(movedHomeProject('Deleted', [RACING])).toBeUndefined();
    expect(movedHomeProject('Racing', [{ name: 'Racing' }])).toBeUndefined();
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
