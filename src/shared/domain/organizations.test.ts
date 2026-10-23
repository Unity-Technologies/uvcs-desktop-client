import { describe, expect, it } from 'vitest';
import { isUnityOrganization, nameInProject, nameWithProject, projectColor, projectOfRepository, projectPartOf, serverKind } from './organizations';

describe('serverKind', () => {
  it('tells Unity organizations from cloud organizations by the alias cm names them with', () => {
    expect(serverKind('danipen_unity@unity')).toBe('unityOrganization');
    expect(serverKind('MyCroquerOrg@Unity')).toBe('unityOrganization');
    expect(serverKind('libra4d@cloud')).toBe('cloudOrganization');
  });

  it('tells this computer and on-premises servers apart from organizations', () => {
    expect(serverKind('local')).toBe('local');
    expect(serverKind('build.acme.com:8087')).toBe('server');
    expect(serverKind('ssl://build:8088')).toBe('server');
  });

  it('takes no wildcard profile nor an organization named with an @ for an organization', () => {
    expect(serverKind('*@cloud')).toBe('server');
    expect(serverKind('repo@acme@unity')).toBe('server');
    expect(isUnityOrganization('acme@cloud')).toBe(false);
    expect(isUnityOrganization('acme@unity')).toBe(true);
  });
});

describe('projectOfRepository', () => {
  const projects = new Set(['Racing', 'Cloud Repositories']);

  it('finds the project a repository is named after', () => {
    expect(projectOfRepository('Racing/Game', projects)).toBe('Racing');
    expect(projectOfRepository('Cloud Repositories/TextEditorSample', projects)).toBe('Cloud Repositories');
  });

  it('takes the part before the first /, a name holding more being the repository\'s own', () => {
    expect(projectOfRepository('Racing/Tools/Build', projects)).toBe('Racing');
    expect(projectPartOf('Racing/Tools/Build')).toBe('Racing');
  });

  it('finds no project part in a name without a /, or starting with one', () => {
    expect(projectPartOf('Game')).toBeUndefined();
    expect(projectPartOf('/Game')).toBeUndefined();
  });

  it('finds none for a name no project starts, or only shares the start of a word with one', () => {
    expect(projectOfRepository('Game', projects)).toBeUndefined();
    expect(projectOfRepository('RacingGame/Art', projects)).toBeUndefined();
    expect(projectOfRepository('Racing', projects)).toBeUndefined();
  });
});

describe('nameInProject', () => {
  it("drops the project's name from the repository's", () => {
    expect(nameInProject('Racing/Game', 'Racing')).toBe('Game');
    expect(nameInProject('Racing/Tools/Build', 'Racing')).toBe('Tools/Build');
  });

  it('keeps the whole name of a repository in no project', () => {
    expect(nameInProject('Game', undefined)).toBe('Game');
  });
});

describe('nameWithProject', () => {
  it('names a repository after the project it is created in, as nameInProject reads it back', () => {
    expect(nameWithProject('Game', 'Racing')).toBe('Racing/Game');
    expect(nameInProject(nameWithProject('Game', 'Racing'), 'Racing')).toBe('Game');
  });

  it('keeps the name of a repository in no project', () => {
    expect(nameWithProject('Game', null)).toBe('Game');
  });
});

describe('projectColor', () => {
  it("picks a project's color by its GUID's last character, as the other clients do", () => {
    // '0' is 48, 48 % 6 = 0; 'a' is 97, 97 % 6 = 1; 'f' is 102, 102 % 6 = 0; '5' is 53, 53 % 6 = 5.
    expect(projectColor('9f4c1b2e-0000-4000-8000-000000000000')).toBe('crimson');
    expect(projectColor('9f4c1b2e-0000-4000-8000-00000000000a')).toBe('orange');
    expect(projectColor('9f4c1b2e-0000-4000-8000-00000000000f')).toBe('crimson');
    expect(projectColor('9f4c1b2e-0000-4000-8000-000000000005')).toBe('violet');
  });

  it('gives a project without a GUID the first color', () => {
    expect(projectColor('')).toBe('crimson');
  });
});
