import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { entryAt, entryToFocus, pairedEntryAt, pairedFocus } from './diffFocus';
import { pairDiffMetas } from './diffMetaPairs';

const entry = (path: string, status: DiffEntry['status'] = 'changed', oldPath?: string): DiffEntry => ({
  status,
  path,
  oldPath,
  itemType: 'file',
  baseRevisionId: 1,
  revisionId: 2,
  repository: 'game@local',
});

const entries = [entry('a.ts'), entry('src/new.ts', 'moved', 'src/old.ts'), entry('b.ts', 'deleted')];

describe('entryAt', () => {
  it('finds a file by its path or the one it moved from, and nothing else', () => {
    expect(entryAt(entries, 'src/old.ts')).toBe(entries[1]);
    expect(entryAt(entries, 'missing.ts')).toBeUndefined();
  });
});

describe('entryToFocus', () => {
  it('finds the file asked for', () => {
    expect(entryToFocus(entries, 'b.ts')).toBe(entries[2]);
  });

  it('finds a moved file by its new or its old path', () => {
    expect(entryToFocus(entries, 'src/new.ts')).toBe(entries[1]);
    expect(entryToFocus(entries, 'src/old.ts')).toBe(entries[1]);
  });

  it('prefers the file now at a path over the one moved away from it', () => {
    const replaced = [entry('x.ts', 'moved', 'y.ts'), entry('y.ts', 'added')];
    expect(entryToFocus(replaced, 'y.ts')).toBe(replaced[1]);
  });

  it('falls back to the first file when the path is not in the list or none is asked for', () => {
    expect(entryToFocus(entries, 'missing.ts')).toBe(entries[0]);
    expect(entryToFocus(entries)).toBe(entries[0]);
  });

  it('has nothing to focus in an empty diff', () => {
    expect(entryToFocus([], 'a.ts')).toBeUndefined();
  });
});

describe('pairedFocus', () => {
  const asset = entry('Art/Hero.png');
  const meta = entry('Art/Hero.png.meta');
  const lonely = entry('Art/Lonely.png.meta', 'added');
  const pairs = pairDiffMetas([asset, meta, entry('b.ts'), lonely]);

  it('opens a paired .meta on its asset, showing the meta', () => {
    expect(pairedFocus(pairs, 'Art/Hero.png.meta')).toEqual({ entry: asset, metaShownFor: 'Art/Hero.png' });
  });

  it('opens an asset on itself, its meta hidden', () => {
    expect(pairedFocus(pairs, 'Art/Hero.png')).toEqual({ entry: asset, metaShownFor: null });
  });

  it('opens a .meta listed on its own row on that row', () => {
    expect(pairedFocus(pairs, 'Art/Lonely.png.meta')).toEqual({ entry: lonely, metaShownFor: null });
  });

  it('falls back to the first row, as entryToFocus does', () => {
    expect(pairedFocus(pairs, 'missing.ts')).toEqual({ entry: asset, metaShownFor: null });
    expect(pairedFocus(pairs)).toEqual({ entry: asset, metaShownFor: null });
  });

  it('opens on the first file rather than a folder listed before it, a Unity folder added with its meta', () => {
    const folder: DiffEntry = { ...entry('Assets/Props', 'added'), itemType: 'directory' };
    const prefab = entry('Assets/Props/box.prefab', 'added');
    const added = pairDiffMetas([folder, entry('Assets/Props.meta', 'added'), prefab]);
    expect(pairedFocus(added)).toEqual({ entry: prefab, metaShownFor: null });
    expect(pairedFocus(added, 'Assets/Props.meta')).toEqual({ entry: folder, metaShownFor: 'Assets/Props' });
  });

  it('opens on a folder when the diff lists nothing else', () => {
    const folder: DiffEntry = { ...entry('empty', 'added'), itemType: 'directory' };
    expect(pairedFocus(pairDiffMetas([folder]))).toEqual({ entry: folder, metaShownFor: null });
  });
});

describe('pairedEntryAt', () => {
  const asset = entry('Art/Hero.png');
  const meta = entry('Art/Hero.png.meta');
  const pairs = pairDiffMetas([asset, meta, entry('b.ts', 'moved', 'old.ts')]);

  it("finds a .meta that joined its asset on the asset's row, showing the meta: a comment on it is gone to there", () => {
    expect(pairedEntryAt(pairs, 'Art/Hero.png.meta')).toEqual({ entry: asset, metaShownFor: 'Art/Hero.png' });
  });

  it('finds any other file on its own row, by its path or the one it moved from', () => {
    expect(pairedEntryAt(pairs, 'Art/Hero.png')).toEqual({ entry: asset, metaShownFor: null });
    expect(pairedEntryAt(pairs, 'old.ts')?.entry.path).toBe('b.ts');
  });

  it('finds nothing for a file the diff has not: the selection stays', () => {
    expect(pairedEntryAt(pairs, 'missing.ts')).toBeNull();
  });
});
