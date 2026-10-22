import { beforeEach, describe, expect, it } from 'vitest';
import type { ItemRevision } from '@shared/domain/history';
import type { HistoryRow } from './historyRows';
import { publishShownRevision, sameShownRevision, shownRevisionOf, useShownRevision } from './shownRevision';

const revision = (changesetId: number, itemType: ItemRevision['itemType'] = 'file'): HistoryRow => ({ kind: 'revision', revision: { changesetId, itemType } as ItemRevision });

beforeEach(() => useShownRevision.setState({ shown: null }));

describe('shownRevisionOf', () => {
  it("is the focused revision's changeset, annotated when the view is", () => {
    expect(shownRevisionOf('a.cs', revision(7), 'annotate', false)).toEqual({ path: 'a.cs', changesetId: 7, view: 'annotate', otherRepository: false });
    expect(shownRevisionOf('a.cs', revision(7), 'diff', false)).toEqual({ path: 'a.cs', changesetId: 7, view: 'history', otherRepository: false });
  });

  it("is a binary's or a move's history, which can't be annotated", () => {
    expect(shownRevisionOf('a.png', revision(7, 'binaryFile'), 'annotate', false)?.view).toBe('history');
    const move: HistoryRow = { kind: 'pathChange', change: { changesetId: 9, owner: 'ana', date: '', description: 'Moved' } };
    expect(shownRevisionOf('a.cs', move, 'annotate', false)).toEqual({ path: 'a.cs', changesetId: 9, view: 'history', otherRepository: false });
  });

  it('says when the item is of another repository, and is none without a row', () => {
    expect(shownRevisionOf('lib/a.cs', revision(3), 'diff', true)?.otherRepository).toBe(true);
    expect(shownRevisionOf('a.cs', undefined, 'diff', false)).toBeNull();
  });
});

describe('publishShownRevision', () => {
  it('changes the store only when the revision shown changes', () => {
    publishShownRevision(shownRevisionOf('a.cs', revision(7), 'diff', false));
    const published = useShownRevision.getState().shown;
    publishShownRevision(shownRevisionOf('a.cs', revision(7), 'diff', false));
    expect(useShownRevision.getState().shown).toBe(published);

    publishShownRevision(shownRevisionOf('a.cs', revision(7), 'annotate', false));
    expect(useShownRevision.getState().shown?.view).toBe('annotate');
    expect(sameShownRevision(null, null)).toBe(true);
  });
});
