import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { cmPlace } from './cmPlace';

describe('cmPlace in a workspace', () => {
  const inWorkspace = cmPlace(workspacePlace('/wk/game'));

  it("runs in the workspace's folder, its arguments as written: cm reads the repository from the folder", () => {
    expect(inWorkspace.options).toEqual({ cwd: '/wk/game' });
    expect(inWorkspace.repository).toBeUndefined();
    expect(inWorkspace.repositoryOption).toEqual([]);
    expect(inWorkspace.spec('br:/main/task')).toBe('br:/main/task');
    expect(inWorkspace.spec('serverpath:/src/a.cs#cs:12')).toBe('serverpath:/src/a.cs#cs:12');
  });
});

describe('cmPlace on a repository without a workspace', () => {
  const onRepository = cmPlace(repositoryPlace('game@local'));

  it('runs outside every workspace and names the repository, as no folder tells cm which', () => {
    expect(onRepository.options).toEqual({ outsideWorkspaces: true });
    expect(onRepository.repository).toBe('game@local');
    expect(onRepository.repositoryOption).toEqual(['--repository=game@local']);
  });

  it('puts the repository on every object and point spec', () => {
    expect(onRepository.spec('br:/main/task')).toBe('br:/main/task@game@local');
    expect(onRepository.spec('cs:12')).toBe('cs:12@game@local');
    expect(onRepository.spec('lb:v1.0')).toBe('lb:v1.0@game@local');
    expect(onRepository.spec('sh:3')).toBe('sh:3@game@local');
    expect(onRepository.spec('att:status')).toBe('att:status@game@local');
    expect(onRepository.spec('serverpath:/src/a.cs#br:/main')).toBe('serverpath:/src/a.cs#br:/main@game@local');
  });

  it('leaves a spec that names its repository already: an xlinked repository stays the one named', () => {
    expect(onRepository.spec('revid:45@lib@local')).toBe('revid:45@lib@local');
    expect(onRepository.spec('cs:7@lib@local')).toBe('cs:7@lib@local');
    expect(onRepository.spec('itemid:27#cs:12@lib@local')).toBe('itemid:27#cs:12@lib@local');
  });

  it("reads an @ in a file's name as part of the name, never as a repository", () => {
    expect(onRepository.spec('serverpath:/art/logo@2x.png#cs:12')).toBe('serverpath:/art/logo@2x.png#cs:12@game@local');
    expect(onRepository.spec('serverpath:/art/logo@2x.png#cs:12@lib@local')).toBe('serverpath:/art/logo@2x.png#cs:12@lib@local');
  });

  it("names a Unity organization's repository as it is written, server and all", () => {
    expect(cmPlace(repositoryPlace('game@acme@cloud')).spec('br:/main')).toBe('br:/main@game@acme@cloud');
  });
});
