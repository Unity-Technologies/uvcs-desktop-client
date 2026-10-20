import { describe, expect, it } from 'vitest';
import type { Page } from '../navigation/pages';
import { pageKey, pagesForFollowed } from './followSelection';

const CS_1: Page = { kind: 'diff', title: 'Changeset 1', target: { kind: 'changeset', changesetId: 1 } };
const CS_2: Page = { kind: 'diff', title: 'Changeset 2', target: { kind: 'changeset', changesetId: 2 } };
const HISTORY: Page = { kind: 'history', path: 'src/player.cs' };

describe('following the selection', () => {
  it('shows the selected object alone, dropping the trail of pages the window went through', () => {
    expect(pagesForFollowed([CS_1], CS_2)).toEqual([CS_2]);
    expect(pagesForFollowed([CS_1, HISTORY], CS_2)).toEqual([CS_2]);
    expect(pagesForFollowed([CS_1, HISTORY], CS_1)).toEqual([CS_1]);
  });

  it('keeps the page as it is when it shows the selected object already, on whichever file it is', () => {
    expect(pagesForFollowed([{ ...CS_1, focusPath: 'src/player.cs' }], CS_1)).toBeNull();
  });

  it('tells pages apart by what they show, whatever order their fields were written in', () => {
    const reordered = { target: { changesetId: 1, kind: 'changeset' }, title: 'Changeset 1', kind: 'diff' } as Page;
    expect(pageKey(reordered)).toBe(pageKey(CS_1));
    const otherChangesetSameTitle: Page = { kind: 'diff', title: 'Changeset 1', target: { kind: 'changeset', changesetId: 2 } };
    expect(pageKey(otherChangesetSameTitle)).not.toBe(pageKey(CS_1));
  });
});
