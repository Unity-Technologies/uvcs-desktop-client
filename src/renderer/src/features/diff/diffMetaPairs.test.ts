import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { pairDiffMetas } from './diffMetaPairs';

const entry = (path: string, status: DiffEntry['status'], itemType: DiffEntry['itemType'] = 'file'): DiffEntry => ({ status, path, itemType, baseRevisionId: 3, revisionId: 5, repository: 'game@local' });

describe('pairDiffMetas', () => {
  it('pairs a .meta with its asset when both changed the same way', () => {
    const asset = entry('Assets/Player.png', 'changed');
    const meta = entry('Assets/Player.png.meta', 'changed');
    const other = entry('Assets/Enemy.png', 'added');
    const pairs = pairDiffMetas([asset, meta, other]);
    expect(pairs.shown).toEqual([asset, other]);
    expect(pairs.metaOf(asset)).toBe(meta);
    expect(pairs.pairedCount).toBe(1);
  });

  it('pairs a folder with its .meta, both added', () => {
    const folder = entry('Assets/Art', 'added', 'directory');
    const meta = entry('Assets/Art.meta', 'added');
    expect(pairDiffMetas([folder, meta]).metaOf(folder)).toBe(meta);
  });

  it('pairs a moved asset with its moved .meta', () => {
    const asset = { ...entry('Assets/New/Player.png', 'moved'), oldPath: 'Assets/Player.png' };
    const meta = { ...entry('Assets/New/Player.png.meta', 'moved'), oldPath: 'Assets/Player.png.meta' };
    expect(pairDiffMetas([asset, meta]).shown).toEqual([asset]);
  });

  it('leaves the .meta on its own row when it changed another way, or its asset is not in the diff', () => {
    const asset = entry('Assets/Player.png', 'changed');
    const addedMeta = entry('Assets/Player.png.meta', 'added');
    const lone = entry('Assets/Enemy.png.meta', 'changed');
    expect(pairDiffMetas([asset, addedMeta, lone]).shown).toEqual([asset, addedMeta, lone]);
  });
});
