import { describe, expect, it } from 'vitest';
import { publishShownBrowseItem, sameShownBrowseItem, useShownBrowseItem } from './shownBrowseItem';

describe('publishShownBrowseItem', () => {
  it('tells only a change, so a page publishing on each render renders nothing again', () => {
    publishShownBrowseItem({ changesetId: 7, path: 'a.cs' });
    const first = useShownBrowseItem.getState().shown;
    publishShownBrowseItem({ changesetId: 7, path: 'a.cs' });
    expect(useShownBrowseItem.getState().shown).toBe(first);
    publishShownBrowseItem({ changesetId: 7, path: 'b.cs' });
    expect(useShownBrowseItem.getState().shown).toEqual({ changesetId: 7, path: 'b.cs' });
    publishShownBrowseItem(null);
  });

  it('compares by value', () => {
    expect(sameShownBrowseItem({ changesetId: 7, path: '' }, { changesetId: 7, path: '' })).toBe(true);
    expect(sameShownBrowseItem({ changesetId: 7, path: '' }, { changesetId: 8, path: '' })).toBe(false);
    expect(sameShownBrowseItem(null, null)).toBe(true);
  });
});
