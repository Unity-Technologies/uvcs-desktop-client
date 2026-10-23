import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { filesItemLink } from '../files/filesItemLink';
import { branchFilesOrigin, filesBranchCaption, filesBranchToRead, repositoryFilesBodyOf } from './shownFilesBranch';

const branch = (name: string, headChangeset: number, guid = `guid-${name}`): Branch => ({
  id: headChangeset,
  name,
  parent: '',
  comment: '',
  owner: 'ana',
  date: '',
  headChangeset,
  guid,
  repository: 'game@local',
});

const main = branch('/main', 12);
const drift = branch('/main/drift', 10);
const read = (data: Branch | null | undefined, error: Error | null = null) => ({ data, error });

describe('the branch Files reads', () => {
  it('is the main branch until another is picked, alone, never the whole list', () => {
    expect(filesBranchToRead(undefined)).toBe('/main');
    expect(filesBranchToRead({ name: '/main/drift', guid: drift.guid })).toBe('/main/drift');
  });
});

describe('repositoryFilesBodyOf', () => {
  it("shows the branch's latest tree once read", () => {
    expect(repositoryFilesBodyOf(read(main), undefined)).toEqual({ kind: 'tree', branch: main });
    expect(repositoryFilesBodyOf(read(drift), { name: '/main/drift', guid: drift.guid.toUpperCase() })).toEqual({ kind: 'tree', branch: drift });
  });

  it('waits while it is read, and says why it could not be', () => {
    expect(repositoryFilesBodyOf(read(undefined), undefined)).toEqual({ kind: 'loading' });
    expect(repositoryFilesBodyOf(read(undefined, new Error('The server is not available')), undefined)).toEqual({ kind: 'error', message: 'The server is not available' });
  });

  it('goes back to the main branch once the branch picked is gone, renamed, or another branch took its name', () => {
    expect(repositoryFilesBodyOf(read(null), { name: '/main/drift', guid: drift.guid })).toEqual({ kind: 'chosenGone' });
    expect(repositoryFilesBodyOf(read(branch('/main/drift', 30, 'another')), { name: '/main/drift', guid: drift.guid })).toEqual({ kind: 'chosenGone' });
  });

  it('asks for a branch to show where the main branch was renamed', () => {
    expect(repositoryFilesBodyOf(read(null), undefined)).toEqual({ kind: 'pickBranch' });
  });
});

describe('filesBranchCaption', () => {
  it('names the branch and the changeset its latest tree is', () => {
    expect(filesBranchCaption(main)).toBe('Latest of /main · changeset 12');
  });
});

describe('the links of Files in a repository', () => {
  const origin = branchFilesOrigin('game@local', drift);
  const item = { path: 'Assets/Player.cs', repository: 'game@local' };

  it('links an item to the branch, so it follows it, and lines to its head changeset, where their numbers hold', () => {
    expect(filesItemLink(origin, item)).toEqual({ object: { kind: 'branch', name: '/main/drift' }, page: { kind: 'browse', path: '/Assets/Player.cs' } });
    expect(filesItemLink(origin, item, { side: 'new', first: 3, last: 5 })).toEqual({
      object: { kind: 'changeset', id: 10 },
      page: { kind: 'browse', path: '/Assets/Player.cs' },
      lines: { side: 'new', first: 3, last: 5 },
    });
  });

  it("links nothing of another repository's item, under an xlink", () => {
    expect(filesItemLink(origin, { ...item, repository: 'lib@local' })).toBeNull();
  });
});
