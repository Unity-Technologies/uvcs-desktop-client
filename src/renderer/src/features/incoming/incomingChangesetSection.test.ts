import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { ALL_ROW_HEIGHT, CHANGESET_ROW_HEIGHT, changesetListMaxHeight, changesetsSummary } from './incomingChangesetSection';

const changeset = (id: number, owner: string): Changeset => ({ id, owner, comment: '', date: '2026-01-01T00:00:00Z', branch: '/main' }) as Changeset;

describe('changesetListMaxHeight', () => {
  it('shows "All incoming changes" and three changesets before scrolling, so the files start right below', () => {
    expect(changesetListMaxHeight()).toBe(ALL_ROW_HEIGHT + 3 * CHANGESET_ROW_HEIGHT);
  });
});

describe('changesetsSummary', () => {
  it('counts the changesets and names each author once, as the closed header says it', () => {
    expect(changesetsSummary([changeset(4, 'ana@x.com'), changeset(3, 'luis.gomez@x.com'), changeset(2, 'ana@x.com')])).toBe('3 changesets · Ana, Luis Gomez');
  });

  it('names the first few authors and counts the rest', () => {
    const owners = ['ana', 'bob', 'cai', 'dee', 'eve'];
    expect(changesetsSummary(owners.map((owner, index) => changeset(index, owner)))).toBe('5 changesets · Ana, Bob, Cai and 2 more');
  });

  it('says one changeset in the singular', () => {
    expect(changesetsSummary([changeset(4, 'ana')])).toBe('1 changeset · Ana');
  });
});
