import { describe, expect, it } from 'vitest';
import type { ItemRevision } from '@shared/domain/history';
import type { Label } from '@shared/domain/label';
import type { HistoryRow } from './historyRows';
import { matchesHistorySearch } from './historySearch';

const revision: ItemRevision = {
  revisionId: 7,
  parentRevisionId: 5,
  changesetId: 42,
  branch: '/main/task-12',
  owner: 'jane.doe@example.com',
  date: '2026-01-01T10:00:00Z',
  comment: 'Fix the jump height\nLonger explanation',
  itemType: 'file',
  size: 100,
  repository: 'game@local',
  idSpec: 'revid:7@game@local',
};
const row: HistoryRow = { kind: 'revision', revision };
const move: HistoryRow = {
  kind: 'pathChange',
  change: { changesetId: 40, owner: 'bob@example.com', date: '2026-01-01T09:00:00Z', description: 'Moved from /Hero.cs to /Player.cs' },
};

describe('matchesHistorySearch', () => {
  it('matches everything when the search is blank', () => {
    expect(matchesHistorySearch(row, '  ')).toBe(true);
  });

  it.each(['42', 'JUMP', 'longer', 'task-12', 'jane.doe', 'Jane Doe'])('matches %s', (search) => {
    expect(matchesHistorySearch(row, search)).toBe(true);
  });

  it('rejects text found in no field', () => {
    expect(matchesHistorySearch(row, 'rocket')).toBe(false);
  });

  it('takes each word on its own, labels too', () => {
    expect(matchesHistorySearch(row, 'jump jane')).toBe(true);
    expect(matchesHistorySearch(row, 'jump rocket')).toBe(false);
    expect(matchesHistorySearch(row, 'release jump', [{ name: 'Release-1.0' } as Label])).toBe(true);
  });

  it.each(['40', 'hero.cs', 'Bob'])('matches a move by %s', (search) => {
    expect(matchesHistorySearch(move, search)).toBe(true);
  });
});
