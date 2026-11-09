import { describe, expect, it } from 'vitest';
import type { MergePlan } from '@shared/domain/merge';
import { buildMergeItems } from './mergeItems';
import { pairMergeMetas } from './mergeMetaPairs';
import type { ConflictedFile } from './resolve/useFileConflicts';

const emptyPlan: MergePlan = { status: 'ready', changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] };

function conflicted(path: string): ConflictedFile {
  return { key: `/${path}`, path, base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } };
}

function paired(changes: MergePlan['changes'], files: ConflictedFile[] = []) {
  const pairs = pairMergeMetas(buildMergeItems({ ...emptyPlan, changes }, [], files));
  return { shown: pairs.shown.map((item) => item.path), metas: pairs.shown.map((item) => pairs.metaOf(item)?.path ?? null), pairedCount: pairs.pairedCount };
}

describe('merge meta pairs', () => {
  it('lists a change to a Unity asset with the same change to its .meta', () => {
    expect(paired([{ kind: 'changed', path: '/Assets/ship.png' }, { kind: 'changed', path: '/Assets/ship.png.meta' }])).toEqual({
      shown: ['Assets/ship.png'],
      metas: ['Assets/ship.png.meta'],
      pairedCount: 1,
    });
  });

  it('keeps an asset and its .meta apart when the merge changes them differently', () => {
    expect(paired([{ kind: 'added', path: '/ship.png' }, { kind: 'changed', path: '/ship.png.meta' }]).shown).toEqual(['ship.png', 'ship.png.meta']);
  });

  it('keeps every file conflict on its own row: each is a decision', () => {
    expect(paired([], [conflicted('ship.png'), conflicted('ship.png.meta')]).shown).toEqual(['ship.png', 'ship.png.meta']);
  });

  it("doesn't join a conflicting .meta to its asset's clean change, nor a clean .meta to a conflicting asset", () => {
    expect(paired([{ kind: 'changed', path: '/a.png' }, { kind: 'changed', path: '/b.png.meta' }], [conflicted('a.png.meta'), conflicted('b.png')]).metas).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});
