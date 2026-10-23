import { describe, expect, it } from 'vitest';
import type { ContentSource } from '@shared/domain/content';
import type { ConflictSide, DirectoryConflict, MergeContributors, MergeRequest } from '@shared/domain/merge';
import { ONLY_MOVED } from '../../diff/viewer/movedFrom';
import { mergeLabels } from '../mergeDescription';
import { comparedVersions, comparisonSegments, comparisonsOf, identicalNoteOf } from './directoryConflictComparison';

const contributors: MergeContributors = {
  source: { changesetId: 42, branch: '/main/feature' },
  destination: { changesetId: 40, branch: '/main' },
  base: { changesetId: 35, branch: '/main' },
};
const merge: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/feature' };

const side = (operation: ConflictSide['operation'], path: string, oldPath?: string): ConflictSide => ({ operation, path, oldPath, description: operation });
const conflict = (type: DirectoryConflict['type'], source: ConflictSide, destination: ConflictSide, isDirectory = false): DirectoryConflict => ({
  type,
  title: type,
  explanation: '',
  itemId: 7,
  isDirectory,
  source,
  destination,
});
const at = (path: string, point: string): ContentSource => ({ kind: 'repositoryPath', path, at: point });
const empty: ContentSource = { kind: 'empty' };

const movedDeleted = conflict('moveDelete', side('moved', '/assets/Legacy.cs', '/assets/old/Legacy.cs'), side('deleted', '/assets/old/Legacy.cs'));
const twins = conflict('evilTwin', side('added', '/src/ui/Theme.cs'), side('added', '/src/ui/Theme.cs'));

describe('comparisonsOf', () => {
  it('compares a file with yours and with the base', () => {
    expect(comparisonsOf(movedDeleted, contributors, merge)).toEqual(['destination', 'base']);
  });

  it('compares only with yours when the plan names no base', () => {
    const { base: _base, ...withoutBase } = contributors;
    expect(comparisonsOf(movedDeleted, withoutBase, merge)).toEqual(['destination']);
  });

  it('compares an incoming item that was added only with yours: the base has nothing of it', () => {
    expect(comparisonsOf(twins, contributors, merge)).toEqual(['destination']);
    expect(comparisonsOf(conflict('addMove', side('added', '/b.cs'), side('moved', '/b.cs', '/a.cs')), contributors, merge)).toEqual(['destination']);
  });

  it("compares only with yours when undoing or cherry picking: cm's base there is no common ancestor", () => {
    expect(comparisonsOf(movedDeleted, contributors, { kind: 'subtractive', sourceSpec: 'cs:42' })).toEqual(['destination']);
    expect(comparisonsOf(movedDeleted, contributors, { kind: 'cherryPick', sourceSpec: 'cs:42' })).toEqual(['destination']);
  });

  it('compares nothing for a folder, an xlink, or a plan without its changesets', () => {
    expect(comparisonsOf(conflict('divergentMove', side('moved', '/b', '/a'), side('moved', '/c', '/a'), true), contributors, merge)).toEqual([]);
    expect(comparisonsOf(conflict('xlink', side('changed', '/lib'), side('changed', '/lib')), contributors, merge)).toEqual([]);
    expect(comparisonsOf(movedDeleted, undefined, merge)).toEqual([]);
  });
});

describe('comparedVersions', () => {
  it('diffs a moved file against yours deleted, and against the base at its old path', () => {
    expect(comparedVersions(movedDeleted, 'destination', contributors, merge)).toEqual({
      original: empty,
      modified: at('/assets/Legacy.cs', 'cs:42'),
      path: '/assets/Legacy.cs',
      oldPath: '/assets/old/Legacy.cs',
    });
    expect(comparedVersions(movedDeleted, 'base', contributors, merge)).toEqual({
      original: at('/assets/old/Legacy.cs', 'cs:35'),
      modified: at('/assets/Legacy.cs', 'cs:42'),
      path: '/assets/Legacy.cs',
      oldPath: '/assets/old/Legacy.cs',
    });
  });

  it('reads yours where you moved it, and names both paths where both sides are files', () => {
    const deletedMoved = conflict('deleteMove', side('deleted', '/src/Menu.cs'), side('moved', '/src/ui/Menu.cs', '/src/Menu.cs'));
    expect(comparedVersions(deletedMoved, 'destination', contributors, merge)).toEqual({ original: at('/src/ui/Menu.cs', 'cs:40'), modified: empty, path: '/src/ui/Menu.cs' });
    const movedApart = conflict('divergentMove', side('moved', '/src/game/Menu.cs', '/src/Menu.cs'), side('moved', '/src/ui/Menu.cs', '/src/Menu.cs'));
    expect(comparedVersions(movedApart, 'destination', contributors, merge)).toEqual({
      original: at('/src/ui/Menu.cs', 'cs:40'),
      modified: at('/src/game/Menu.cs', 'cs:42'),
      path: '/src/game/Menu.cs',
      oldPath: '/src/ui/Menu.cs',
    });
  });

  it('diffs two files added with the same name against each other', () => {
    expect(comparedVersions(twins, 'destination', contributors, merge)).toEqual({ original: at('/src/ui/Theme.cs', 'cs:40'), modified: at('/src/ui/Theme.cs', 'cs:42'), path: '/src/ui/Theme.cs' });
  });

  it('reads an incoming item moved onto an added one at its old path in the base', () => {
    const movedOnto = conflict('movedEvilTwin', side('moved', '/src/Theme.cs', '/src/old/Theme.cs'), side('added', '/src/Theme.cs'));
    expect(comparedVersions(movedOnto, 'base', contributors, merge).original).toEqual(at('/src/old/Theme.cs', 'cs:35'));
    expect(comparedVersions(movedOnto, 'destination', contributors, merge).original).toEqual(at('/src/Theme.cs', 'cs:40'));
  });

  it('diffs an incoming delete as empty against yours changed, and against the base', () => {
    const deleted = conflict('deleteChange', side('deleted', '/src/ui/Menu.cs'), side('changed', '/src/ui/Menu.cs'));
    expect(comparedVersions(deleted, 'destination', contributors, merge)).toEqual({ original: at('/src/ui/Menu.cs', 'cs:40'), modified: empty, path: '/src/ui/Menu.cs' });
    expect(comparedVersions(deleted, 'base', contributors, merge)).toEqual({ original: at('/src/ui/Menu.cs', 'cs:35'), modified: empty, path: '/src/ui/Menu.cs' });
  });

  it('reads a shelve merge’s incoming side from the shelve', () => {
    const changed = conflict('changeDelete', side('changed', '/a.cs'), side('deleted', '/a.cs'));
    expect(comparedVersions(changed, 'destination', contributors, { kind: 'merge', sourceSpec: 'sh:7' }).modified).toEqual(at('/a.cs', 'sh:7'));
  });
});

describe('comparisonSegments', () => {
  const workspace = mergeLabels(merge, { status: 'ready', contributors, changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] });

  it("names the sides in a workspace's words, and a server branch's", () => {
    expect(comparisonSegments(['destination', 'base'], workspace)).toEqual([
      { value: 'destination', label: 'Incoming ↔ Yours', title: '/main/feature against /main' },
      { value: 'base', label: 'Incoming ↔ Base', title: '/main/feature against the common ancestor' },
    ]);
    const server = mergeLabels({ ...merge, destinationBranch: '/main' }, undefined);
    expect(comparisonSegments(['destination', 'base'], server).map((segment) => segment.label)).toEqual(['Source ↔ Destination', 'Source ↔ Base']);
  });

  it('offers no switch with one comparison to show', () => {
    expect(comparisonSegments(['destination'], workspace)).toEqual([]);
  });
});

describe('identicalNoteOf', () => {
  it('says an incoming move kept the content when compared with the base, and leaves the rest to the diff', () => {
    expect(identicalNoteOf(movedDeleted, 'base')).toBe(ONLY_MOVED);
    expect(identicalNoteOf(movedDeleted, 'destination')).toBeUndefined();
    expect(identicalNoteOf(conflict('changeDelete', side('changed', '/a.cs'), side('deleted', '/a.cs')), 'base')).toBeUndefined();
  });
});
