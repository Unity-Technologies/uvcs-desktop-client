import { describe, expect, it } from 'vitest';
import type { ChangeKind, ItemType, PendingChange } from '@shared/domain/pendingChanges';
import { isScored, movePairsOf, scoredCandidates, searchedRows, similarityLabel, similarityTip } from './matchSimilarity';

const change = (path: string, kinds: ChangeKind[], itemType: ItemType = 'file', size = 10): PendingChange => ({ path, kinds, itemType, size, lastModified: '' });
const deleted = change('src/Player.cs', ['locallyDeleted'], 'file', 120);
const hero = change('src/Hero.cs', ['private'], 'file', 90);
const enemy = change('src/Enemy.cs', ['private'], 'file', 40);
const boss = change('src/Boss.cs', ['private'], 'file', 50);
const paths = (rows: { candidate: PendingChange }[]) => rows.map((row) => row.candidate.path);

describe('the pairs measured', () => {
  it('puts the deleted item first, whichever side the dialog was opened on, with the sizes Changes listed', () => {
    expect(movePairsOf(deleted, [hero], 'deleted')).toEqual([
      { deleted: { path: 'src/Player.cs', itemType: 'file', size: 120 }, added: { path: 'src/Hero.cs', itemType: 'file', size: 90 } },
    ]);
    expect(movePairsOf(hero, [deleted], 'new')).toEqual([
      { deleted: { path: 'src/Player.cs', itemType: 'file', size: 120 }, added: { path: 'src/Hero.cs', itemType: 'file', size: 90 } },
    ]);
  });

  it('measures files only', () => {
    expect(isScored(deleted)).toBe(true);
    expect(isScored(change('art/a.png', ['private'], 'binaryFile'))).toBe(true);
    expect(isScored(change('src', ['locallyDeleted'], 'directory'))).toBe(false);
  });
});

describe('the rows', () => {
  const candidates = [hero, enemy, boss];

  it('keeps the candidates as they are while the similarities are unknown', () => {
    expect(paths(scoredCandidates(candidates, undefined, 50))).toEqual(['src/Hero.cs', 'src/Enemy.cs', 'src/Boss.cs']);
  });

  it('orders by similarity, the most alike first, those it could not tell last', () => {
    expect(scoredCandidates(candidates, [0.2, null, 0.85], 0)).toEqual([
      { candidate: boss, similarity: 0.85 },
      { candidate: hero, similarity: 0.2 },
      { candidate: enemy, similarity: null },
    ]);
  });

  it('keeps the candidates at least as alike as the minimum, and those it could not tell', () => {
    expect(paths(scoredCandidates(candidates, [0.2, null, 0.85], 50))).toEqual(['src/Boss.cs', 'src/Enemy.cs']);
    expect(paths(scoredCandidates(candidates, [0.5, 0.49, 1], 50))).toEqual(['src/Boss.cs', 'src/Hero.cs']);
  });

  it('keeps the candidates order between equally alike ones', () => {
    expect(paths(scoredCandidates(candidates, [0.4, 0.4, 0.4], 0))).toEqual(['src/Hero.cs', 'src/Enemy.cs', 'src/Boss.cs']);
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

  it('says what it measures for text and binary files, and why it is missing', () => {
    expect(similarityTip(hero, 0.5)).toBe('How many lines are the same');
    expect(similarityTip(change('a.png', ['private'], 'binaryFile'), 0.5)).toBe('How close the sizes are');
    expect(similarityTip(hero, null)).toBe('Not measured: too large or unreadable');
  });
});
