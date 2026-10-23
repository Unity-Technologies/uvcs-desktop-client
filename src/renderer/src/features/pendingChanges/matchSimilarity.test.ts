import { describe, expect, it } from 'vitest';
import type { ChangeKind, ItemType, PendingChange } from '@shared/domain/pendingChanges';
import { isScored, movePairsOf, moveSimilaritiesKey, pairableCount, scoredCandidates, searchedRows, showsMinimum, similarityLabel, similarityTip } from './matchSimilarity';
import { isAffectedByFileChanges, isAffectedByPendingChangeEdit, isAffectedByRecordedMove, isAffectedByWorkspaceState } from '../../app/refresh/refreshScopes';

const change = (path: string, kinds: ChangeKind[], itemType: ItemType = 'file', size = 10): PendingChange => ({ path, kinds, itemType, size, lastModified: '' });
const deleted = change('src/Player.cs', ['locallyDeleted'], 'file', 120);
const hero = change('src/Hero.cs', ['private'], 'file', 90);
const enemy = change('src/Enemy.cs', ['private'], 'file', 40);
const boss = change('src/Boss.cs', ['private'], 'file', 50);
const paths = (rows: { candidate: { path: string } }[]) => rows.map((row) => row.candidate.path);

describe('the pairs measured', () => {
  it('puts the deleted file first, whichever side the dialog was opened on', () => {
    expect(movePairsOf(deleted, [hero], 'deleted')).toEqual([{ deleted: 'src/Player.cs', added: 'src/Hero.cs' }]);
    expect(movePairsOf(hero, [deleted], 'new')).toEqual([{ deleted: 'src/Player.cs', added: 'src/Hero.cs' }]);
  });

  it('measures files only', () => {
    expect(isScored(deleted)).toBe(true);
    expect(isScored(change('src', ['locallyDeleted'], 'directory'))).toBe(false);
  });
});

describe('the rows', () => {
  const candidates = [hero, enemy, boss];

  it('keeps the candidates as they are while the similarities are unknown', () => {
    expect(paths(scoredCandidates(candidates, undefined, 50))).toEqual(['src/Hero.cs', 'src/Enemy.cs', 'src/Boss.cs']);
  });

  it('orders by similarity, the most alike first, those it could not measure last', () => {
    expect(scoredCandidates(candidates, [0.2, 'notMeasured', 0.85], 0)).toEqual([
      { candidate: boss, similarity: 0.85 },
      { candidate: hero, similarity: 0.2 },
      { candidate: enemy, similarity: null },
    ]);
  });

  it("leaves out what cm wouldn't pair, a text file with a binary one", () => {
    expect(paths(scoredCandidates(candidates, [0.2, 'notPairable', 0.85], 0))).toEqual(['src/Boss.cs', 'src/Hero.cs']);
  });

  it('keeps the candidates at least as alike as the minimum, and those it could not measure', () => {
    expect(paths(scoredCandidates(candidates, [0.2, 'notMeasured', 0.85], 50))).toEqual(['src/Boss.cs', 'src/Enemy.cs']);
    expect(paths(scoredCandidates(candidates, [0.5, 0.49, 1], 50))).toEqual(['src/Boss.cs', 'src/Hero.cs']);
  });

  it('keeps the candidates order between equally alike ones', () => {
    expect(paths(scoredCandidates(candidates, [0.4, 0.4, 0.4], 0))).toEqual(['src/Hero.cs', 'src/Enemy.cs', 'src/Boss.cs']);
  });
});

describe('the slider', () => {
  it('counts the candidates cm would pair, once measured', () => {
    expect(pairableCount(undefined)).toBeUndefined();
    expect(pairableCount([0.5, 'notPairable', 'notMeasured'])).toBe(2);
  });

  it('shows for files with candidates, until none of them is known to pair', () => {
    expect(showsMinimum(deleted, 3, undefined)).toBe(true);
    expect(showsMinimum(deleted, 3, 2)).toBe(true);
    expect(showsMinimum(deleted, 3, 0)).toBe(false);
    expect(showsMinimum(deleted, 0, undefined)).toBe(false);
    expect(showsMinimum(change('src', ['locallyDeleted'], 'directory'), 3, undefined)).toBe(false);
  });
});

describe('the measure, once asked', () => {
  // A file saved while the dialog shows would measure everything again: a cm ls, cm cats and every new file read.
  it("is refreshed by no edit of the workspace's files or state", () => {
    const key = moveSimilaritiesKey('/ws', 'src/Player.cs');
    for (const affected of [isAffectedByFileChanges, isAffectedByWorkspaceState, isAffectedByPendingChangeEdit, isAffectedByRecordedMove]) {
      expect(affected(key)).toBe(false);
    }
  });
});

describe('the search', () => {
  it('keeps the rows whose path holds the words typed, in their order, similarities and all', () => {
    const rows = scoredCandidates([hero, enemy, boss], [0.1, 0.9, 0.5], 0);

    expect(searchedRows(rows, 'e')).toEqual([{ candidate: enemy, similarity: 0.9 }, { candidate: hero, similarity: 0.1 }]);
    expect(searchedRows(rows, '')).toBe(rows);
  });
});

describe('the similarity shown', () => {
  it('reads as a whole percentage, rounded down, or a dash', () => {
    expect(similarityLabel(0.996)).toBe('99%');
    expect(similarityLabel(1)).toBe('100%');
    expect(similarityLabel(0)).toBe('0%');
    expect(similarityLabel(0.29)).toBe('29%');
    expect(similarityLabel(null)).toBe('–');
  });

  it('says what it measures, and why it is missing', () => {
    expect(similarityTip(0.5)).toBe('Lines alike for text, size for a binary file');
    expect(similarityTip(null)).toBe('Not measured: too large or unreadable');
  });
});
