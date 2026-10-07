import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { firstOlderPageParam, listedIncomingChangesets, nextOlderPageParam, showMoreStep } from './olderChangesetPages';

const changeset = (id: number): Changeset => ({ id }) as Changeset;
const ids = (changesets: Changeset[]) => changesets.map((one) => one.id);

describe('older incoming changeset pages', () => {
  it('start older than the oldest changeset the first page read', () => {
    expect(firstOlderPageParam({ changesets: [changeset(9), changeset(8)], headChangeset: 9 })).toBe(8);
    expect(firstOlderPageParam({ changesets: [], headChangeset: 9 })).toBe(9);
  });

  it('go on older than the oldest of the last page while it says more remain', () => {
    expect(nextOlderPageParam({ changesets: [changeset(5), changeset(4)], more: true })).toBe(4);
    expect(nextOlderPageParam({ changesets: [changeset(3)], more: false })).toBeUndefined();
  });

  it('list the first page alone, and whether more remain, until another is read', () => {
    const listed = listedIncomingChangesets({ changesets: [changeset(9), changeset(8)], moreChangesets: true }, []);
    expect(ids(listed.changesets)).toEqual([9, 8]);
    expect(listed.more).toBe(true);
  });

  it('list every page read after the first, newest first, and the last page tells whether more remain', () => {
    const first = { changesets: [changeset(9), changeset(8)], moreChangesets: true };
    const listed = listedIncomingChangesets(first, [{ changesets: [changeset(7), changeset(6)], more: true }, { changesets: [changeset(5)], more: false }]);
    expect(ids(listed.changesets)).toEqual([9, 8, 7, 6, 5]);
    expect(listed.more).toBe(false);
  });
});

describe('showMoreStep', () => {
  it('reads the next page after those already read, even when the list was left and opened again', () => {
    expect(showMoreStep([{ changesets: [changeset(7)], more: true }])).toBe('nextPage');
  });

  it('reads the first older page while none is read, after a failure too', () => {
    expect(showMoreStep(undefined)).toBe('firstPage');
    expect(showMoreStep([])).toBe('firstPage');
  });
});
