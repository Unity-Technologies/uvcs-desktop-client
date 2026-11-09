import { describe, expect, it } from 'vitest';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { pairPendingMetas } from './pendingMetaPairs';

const change = (path: string, kinds: ChangeKind[], changelist?: string): PendingChange => ({ path, kinds, itemType: 'file', size: 0, lastModified: '', changelist });

describe('pairPendingMetas', () => {
  it('pairs a .meta with its asset when both changed the same way, in the same changelist', () => {
    const asset = change('Assets/Player.png', ['checkedOut', 'changed']);
    const meta = change('Assets/Player.png.meta', ['checkedOut', 'changed']);
    const pairs = pairPendingMetas([asset, meta]);
    expect(pairs.shown).toEqual([asset]);
    expect(pairs.metaOf(asset)).toBe(meta);
    expect(pairs.pairedCount).toBe(1);
  });

  it('leaves the .meta on its own row when it changed another way or sits in another changelist', () => {
    const asset = change('Assets/Player.png', ['changed']);
    const otherKind = change('Assets/Player.png.meta', ['checkedOut', 'changed']);
    const otherList = change('Assets/Player.png.meta', ['changed'], 'art');
    expect(pairPendingMetas([asset, otherKind]).shown).toEqual([asset, otherKind]);
    expect(pairPendingMetas([asset, otherList]).shown).toEqual([asset, otherList]);
  });
});
