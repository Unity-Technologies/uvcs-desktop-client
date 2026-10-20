import { describe, expect, it } from 'vitest';
import { conflictStepKeys } from './conflictSteps';

describe('conflictStepKeys', () => {
  const waiting = new Set(['a.ts', 'c.ts']);
  const rows = [
    { type: 'group', key: 'group:conflicts' },
    { type: 'folder', key: 'folder:src', item: 'src' },
    { type: 'file', key: 'file:a', item: 'a.ts' },
    { type: 'file', key: 'file:b', item: 'b.ts' },
    { type: 'file', key: 'file:c', item: 'c.ts' },
  ];

  it('keeps the files still waiting, as the list shows them, and the one shown', () => {
    expect(conflictStepKeys(rows, 'file:b', (path) => waiting.has(path))).toEqual(['file:a', 'file:b', 'file:c']);
    expect(conflictStepKeys(rows, 'file:a', (path) => waiting.has(path))).toEqual(['file:a', 'file:c']);
  });

  it('never steps to a group or a folder, even a folder that is a conflict', () => {
    expect(conflictStepKeys(rows, null, () => true)).toEqual(['file:a', 'file:b', 'file:c']);
  });
});
