import { describe, expect, it } from 'vitest';
import type { ItemRevision } from '@shared/domain/history';
import type { Label } from '@shared/domain/label';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { filteredHistoryRows, type HistoryFilters } from './historyFilters';
import { historyRowKey, type HistoryRow } from './historyRows';

const revision = (changesetId: number, owner: string, comment: string): HistoryRow => ({
  kind: 'revision',
  revision: { changesetId, revisionId: changesetId * 10, owner, comment, branch: '/main' } as ItemRevision,
});
const rows: HistoryRow[] = [
  revision(9, 'ana', 'Tune the jump'),
  { kind: 'pathChange', change: { changesetId: 8, owner: 'bob', date: '', description: 'Moved from /a.cs to /b.cs' } },
  revision(5, 'bob', 'Add the hero'),
];
const release = { name: 'release-1.0' } as Label;
const filters: HistoryFilters = { search: '', people: EVERYONE, me: 'ana', labelsByChangeset: new Map([[5, [release]]]) };
const shown = (changed: Partial<HistoryFilters>) => filteredHistoryRows(rows, { ...filters, ...changed }).map(historyRowKey);

describe('filteredHistoryRows', () => {
  it('shows every revision and move without filters', () => {
    expect(shown({})).toEqual(['9', '8-path', '5']);
  });

  it('shows what the people picked made', () => {
    expect(shown({ people: MINE })).toEqual(['9']);
    expect(shown({ people: { mine: false, others: ['bob'] } })).toEqual(['8-path', '5']);
  });

  it("finds revisions by their changesets' labels, and moves by what they did", () => {
    expect(shown({ search: 'release' })).toEqual(['5']);
    expect(shown({ search: 'moved' })).toEqual(['8-path']);
  });

  it('shows only what both the people and the search let through', () => {
    expect(shown({ people: MINE, search: 'hero' })).toEqual([]);
  });
});
