import { describe, expect, it } from 'vitest';
import type { ContentSource } from '@shared/domain/content';
import type { ConflictSide, DirectoryConflict, MergeContributors, MergeRequest } from '@shared/domain/merge';
import { mergeLabels } from '../mergeDescription';
import { ONLY_MOVED } from '../../diff/viewer/movedFrom';
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

describe('comparisonsOf', () => {
  const moved = conflict('moveDelete', side('moved', '/assets/Legacy.cs', '/assets/old/Legacy.cs'), side('deleted', '/assets/old/Legacy.cs'));

  it('compares a file with yours and with the base', () => {
    expect(comparisonsOf(moved, contributors)).toEqual(['destination', 'base']);
  });

  it('compares only with yours when the plan names no base', () => {
    const { base: _base, ...withoutBase } = contributors;
    expect(comparisonsOf(moved, withoutBase)).toEqual(['destination']);
  });

  it('compares nothing for a folder, an xlink, or a plan without its changesets', () => {
    expect(comparisonsOf(conflict('divergentMove', side('moved', '/b', '/a'), side('moved', '/c', '/a'), true), contributors)).toEqual([]);
    expect(comparisonsOf(conflict('xlink', side('changed', '/lib'), side('changed', '/lib')), contributors)).toEqual([]);
    expect(comparisonsOf(moved, undefined)).toEqual([]);
  });
});

describe('comparedVersions', () => {
  it('diffs a moved file against yours deleted, and against the base at its old path', () => {
    const moved = conflict('moveDelete', side('moved', '/assets/Legacy.cs', '/assets/old/Legacy.cs'), side('deleted', '/assets/old/Legacy.cs'));
    expect(comparedVersions(moved, 'destination', contributors, merge)).toEqual({ original: empty, modified: at('/assets/Legacy.cs', 'cs:42') });
    expect(comparedVersions(moved, 'base', contributors, merge)).toEqual({ original: at('/assets/old/Legacy.cs', 'cs:35'), modified: at('/assets/Legacy.cs', 'cs:42') });
  });

  it('diffs two files added with the same name against each other, and the incoming one against nothing at the base', () => {
    const twins = conflict('evilTwin', side('added', '/src/shared/Config.cs'), side('added', '/src/shared/Config.cs'));
    expect(comparedVersions(twins, 'destination', contributors, merge)).toEqual({ original: at('/src/shared/Config.cs', 'cs:40'), modified: at('/src/shared/Config.cs', 'cs:42') });
    expect(comparedVersions(twins, 'base', contributors, merge)).toEqual({ original: empty, modified: at('/src/shared/Config.cs', 'cs:42') });
  });

  it('diffs an incoming delete as empty against yours changed', () => {
    const deleted = conflict('deleteChange', side('deleted', '/src/ui/Menu.cs'), side('changed', '/src/ui/Menu.cs'));
    expect(comparedVersions(deleted, 'destination', contributors, merge)).toEqual({ original: at('/src/ui/Menu.cs', 'cs:40'), modified: empty });
    expect(comparedVersions(deleted, 'base', contributors, merge)).toEqual({ original: at('/src/ui/Menu.cs', 'cs:35'), modified: empty });
  });

  it('reads a shelve merge’s incoming side from the shelve', () => {
    const changed = conflict('changeDelete', side('changed', '/a.cs'), side('deleted', '/a.cs'));
    expect(comparedVersions(changed, 'destination', contributors, { kind: 'merge', sourceSpec: 'sh:7' }).modified).toEqual(at('/a.cs', 'sh:7'));
  });
});

describe('comparisonSegments', () => {
  it("names the sides in a workspace's words, and a server branch's", () => {
    const workspace = mergeLabels(merge, { status: 'ready', contributors, changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] });
    expect(comparisonSegments(['destination', 'base'], workspace).map((segment) => segment.label)).toEqual(['Incoming ↔ Yours', 'Incoming ↔ Base']);
    const server = mergeLabels({ ...merge, destinationBranch: '/main' }, undefined);
    expect(comparisonSegments(['destination'], server)).toEqual([{ value: 'destination', label: 'Source ↔ Destination', title: '/main/feature against /main' }]);
  });
});

describe('identicalNoteOf', () => {
  it('says an incoming move kept the content when compared with the base, and leaves the rest to the diff', () => {
    const moved = conflict('moveDelete', side('moved', '/assets/Legacy.cs', '/assets/old/Legacy.cs'), side('deleted', '/assets/old/Legacy.cs'));
    expect(identicalNoteOf(moved, 'base')).toBe(ONLY_MOVED);
    expect(identicalNoteOf(moved, 'destination')).toBeUndefined();
    expect(identicalNoteOf(conflict('changeDelete', side('changed', '/a.cs'), side('deleted', '/a.cs')), 'base')).toBeUndefined();
  });
});
