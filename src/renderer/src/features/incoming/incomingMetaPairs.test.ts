import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { pairIncomingMetas } from './incomingMetaPairs';

const entry = (path: string, status: DiffEntry['status'] = 'changed'): DiffEntry => ({ status, path, itemType: 'file', baseRevisionId: 3, revisionId: 5, repository: 'game@local' });
const collidingWith = (...paths: string[]) => (file: DiffEntry) => paths.includes(file.path);

describe('pairIncomingMetas', () => {
  it('lists a .meta with its asset when the update changes both the same way', () => {
    const asset = entry('Assets/Player.png');
    const meta = entry('Assets/Player.png.meta');
    const pairs = pairIncomingMetas([asset, meta], collidingWith());
    expect(pairs.shown).toEqual([asset]);
    expect(pairs.metaOf(asset)).toBe(meta);
  });

  it('keeps a .meta that collides with local changes on its own row, where its conflict is settled', () => {
    const asset = entry('Assets/Player.png');
    const meta = entry('Assets/Player.png.meta');
    expect(pairIncomingMetas([asset, meta], collidingWith('Assets/Player.png.meta')).shown).toEqual([asset, meta]);
  });

  it('lists a clean .meta with an asset that collides', () => {
    const asset = entry('Assets/Player.png');
    const meta = entry('Assets/Player.png.meta');
    expect(pairIncomingMetas([asset, meta], collidingWith('Assets/Player.png')).metaOf(asset)).toBe(meta);
  });

  it('keeps a .meta the update changes another way on its own row', () => {
    const asset = entry('Assets/Player.png', 'changed');
    const meta = entry('Assets/Player.png.meta', 'added');
    expect(pairIncomingMetas([asset, meta], collidingWith()).shown).toEqual([asset, meta]);
  });
});
