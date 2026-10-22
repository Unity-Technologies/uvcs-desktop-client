import { beforeEach, describe, expect, it } from 'vitest';
import { publishShownDiffFile, sameShownFile, shownFileOf, useShownDiffFile } from './shownDiffFile';

const CS12 = { kind: 'changeset', changesetId: 12 } as const;

beforeEach(() => useShownDiffFile.setState({ shown: null }));

describe('sameShownFile', () => {
  it('compares by what the diff compares and the file, not by object', () => {
    expect(sameShownFile({ target: { ...CS12 }, path: 'a.cs' }, { target: { ...CS12 }, path: 'a.cs' })).toBe(true);
    expect(sameShownFile({ target: CS12, path: 'a.cs' }, { target: CS12, path: 'b.cs' })).toBe(false);
    expect(sameShownFile({ target: CS12, path: 'a.cs' }, { target: { kind: 'changeset', changesetId: 13 }, path: 'a.cs' })).toBe(false);
    expect(sameShownFile(null, null)).toBe(true);
    expect(sameShownFile(null, { target: CS12, path: 'a.cs' })).toBe(false);
  });
});

describe('publishShownDiffFile', () => {
  it('changes the store only when the file shown changes, so a new target object each render publishes nothing', () => {
    publishShownDiffFile({ target: { ...CS12 }, path: 'a.cs' });
    const published = useShownDiffFile.getState().shown;
    publishShownDiffFile({ target: { ...CS12 }, path: 'a.cs' });

    expect(useShownDiffFile.getState().shown).toBe(published);
    expect(shownFileOf(CS12)).toBe('a.cs');
    publishShownDiffFile(null);
    expect(shownFileOf(CS12)).toBeUndefined();
  });
});
