import { describe, expect, it } from 'vitest';
import { isUnityOrganization, nameInProject, projectOfRepository, serverKind } from './organizations';

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
  const projects = new Set(['Racing', 'Cloud Repositories', 'Racing/Tools']);

  it('finds the project a repository is named after', () => {
    expect(projectOfRepository('Racing/Game', projects)).toBe('Racing');
    expect(projectOfRepository('Cloud Repositories/TextEditorSample', projects)).toBe('Cloud Repositories');
  });

  it('takes the longest project the name starts with', () => {
    expect(projectOfRepository('Racing/Tools/Build', projects)).toBe('Racing/Tools');
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
    expect(nameInProject('Racing/Tools/Build', 'Racing/Tools')).toBe('Build');
  });

  it('keeps the whole name of a repository in no project', () => {
    expect(nameInProject('Game', undefined)).toBe('Game');
  });
});
