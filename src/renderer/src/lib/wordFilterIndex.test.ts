import { describe, expect, it } from 'vitest';
import { countCalls } from '@shared/testing/countCalls';
import { createWordFilterIndex } from './wordFilterIndex';

const rows = [
  ['/main/scm1042', '[CLI]: cm ls: resolve owner names in one batch'],
  ['/main/task7', 'Faster checkin of big files'],
  ['/main/FIX-crash', ''],
];
const index = createWordFilterIndex(rows);
const nothingShown = () => false;

describe('createWordFilterIndex', () => {
  it('finds a row by a word of any of its texts', () => {
    expect(index.matching('batch', 10, nothingShown)).toEqual([0]);
    expect(index.matching('task7', 10, nothingShown)).toEqual([1]);
  });

  it('needs every word typed, in any order, each in any of the texts', () => {
    expect(index.matching('owner resolve', 10, nothingShown)).toEqual([0]);
    expect(index.matching('scm1042 batch', 10, nothingShown)).toEqual([0]);
    expect(index.matching('owner checkin', 10, nothingShown)).toEqual([]);
  });

  it('takes punctuation as typed', () => {
    expect(index.matching('[CLI] cm ls', 10, nothingShown)).toEqual([0]);
    expect(index.matching('[CLI]:', 10, nothingShown)).toEqual([0]);
    expect(index.matching('(CLI)', 10, nothingShown)).toEqual([]);
  });

  it('ignores case, in the texts and in what is typed', () => {
    expect(index.matching('cli BATCH', 10, nothingShown)).toEqual([0]);
    expect(index.matching('fix-CRASH', 10, nothingShown)).toEqual([2]);
  });

  it('finds nothing for a blank query', () => {
    expect(index.matching('  ', 10, nothingShown)).toEqual([]);
  });

  it('leaves out the rows already shown, in the order the rows came, up to the limit', () => {
    const many = createWordFilterIndex([['a', 'fix'], ['b', 'fix'], ['c', 'fix'], ['d', 'fix']]);

    expect(many.matching('fix', 2, (row) => row === 0)).toEqual([1, 2]);
  });

  it('lower-cases each text once when built, not on every query, however many rows there are', () => {
    // 20,000 rows: the branches of a large repository, which the palette searches on every keystroke.
    const branches = Array.from({ length: 20_000 }, (_, id) => [`/main/task${id}`, `Comment number ${id}`]);
    const built = countCalls(String.prototype, 'toLowerCase', () => createWordFilterIndex(branches));
    const queried = countCalls(String.prototype, 'toLowerCase', () => {
      for (const query of ['c', 'co', 'com', 'comment 19999']) built.result.matching(query, 50, nothingShown);
    });

    expect(built.calls).toBe(20_000);
    expect(queried.calls).toBe(4);
  });

  it('stops looking once it has the rows asked for', () => {
    const branches = Array.from({ length: 20_000 }, (_, id) => [`/main/task${id}`, 'Same comment']);
    const searched = createWordFilterIndex(branches);
    const { calls } = countCalls(String.prototype, 'includes', () => searched.matching('same', 50, nothingShown));

    expect(calls).toBe(50);
  });
});
