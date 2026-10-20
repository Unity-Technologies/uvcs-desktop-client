import { describe, expect, it } from 'vitest';
import type { MergeChange, MergeContributors, MergeRequest } from '@shared/domain/merge';
import { changePreviewOf } from './mergeChangeVersions';

const contributors: MergeContributors = {
  source: { changesetId: 42, branch: '/main/task' },
  destination: { changesetId: 40, branch: '/main' },
  base: { changesetId: 35, branch: '/main' },
};
const merge: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task' };
const change = (kind: MergeChange['kind'], path = '/src/app.ts', oldPath?: string): MergeChange => (oldPath ? { kind, path, oldPath } : { kind, path });
const at = (path: string, point: string) => ({ kind: 'repositoryPath', path, at: point });

describe('changePreviewOf', () => {
  it('compares a changed file at the common ancestor with the source', () => {
    expect(changePreviewOf(change('changed'), contributors, merge)).toEqual({ kind: 'diff', original: at('/src/app.ts', 'cs:35'), modified: at('/src/app.ts', 'cs:42') });
  });

  it('compares a moved file from where it was', () => {
    expect(changePreviewOf(change('moved', '/src/main.ts', '/src/app.ts'), contributors, merge)).toEqual({
      kind: 'diff',
      original: at('/src/app.ts', 'cs:35'),
      modified: at('/src/main.ts', 'cs:42'),
    });
  });

  it('shows an added file whole, as the source has it, and a deleted one as the destination has it', () => {
    expect(changePreviewOf(change('added'), contributors, merge)).toEqual({ kind: 'diff', original: { kind: 'empty' }, modified: at('/src/app.ts', 'cs:42') });
    expect(changePreviewOf(change('deleted'), contributors, merge)).toEqual({ kind: 'diff', original: at('/src/app.ts', 'cs:40'), modified: { kind: 'empty' } });
  });

  it('compares from the destination when there is no common ancestor', () => {
    const { base: _base, ...withoutBase } = contributors;
    expect(changePreviewOf(change('changed'), withoutBase, merge)).toEqual({ kind: 'diff', original: at('/src/app.ts', 'cs:40'), modified: at('/src/app.ts', 'cs:42') });
  });

  it('reads the source of a shelve in the shelve', () => {
    const shelve: MergeRequest = { kind: 'merge', sourceSpec: 'sh:7' };
    expect(changePreviewOf(change('added'), contributors, shelve)).toEqual({ kind: 'diff', original: { kind: 'empty' }, modified: at('/src/app.ts', 'sh:7') });
  });

  it('takes the destination back to the ancestor when undoing a changeset', () => {
    const subtractive: MergeRequest = { kind: 'subtractive', sourceSpec: 'cs:42' };
    expect(changePreviewOf(change('changed'), contributors, subtractive)).toEqual({ kind: 'diff', original: at('/src/app.ts', 'cs:40'), modified: at('/src/app.ts', 'cs:35') });
  });

  it('says so when only the permissions change', () => {
    expect(changePreviewOf(change('permissions'), contributors, merge)).toEqual({ kind: 'permissionsOnly' });
  });

  it('has no versions to compare when the plan named no source and destination, and never calls that a permissions change', () => {
    for (const kind of ['added', 'changed', 'deleted', 'moved'] as const) expect(changePreviewOf(change(kind), undefined, merge)).toEqual({ kind: 'noVersions' });
    expect(changePreviewOf(change('permissions'), undefined, merge)).toEqual({ kind: 'permissionsOnly' });
  });
});
