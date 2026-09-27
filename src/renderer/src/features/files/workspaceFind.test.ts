import { describe, expect, it } from 'vitest';
import { createFuzzyIndex } from '../../lib/fuzzyIndex';
import { findItems } from './workspaceFind';

const items = [
  { path: 'Assets', isDirectory: true },
  { path: 'Assets/Scripts', isDirectory: true },
  { path: 'Assets/Scripts/GameManager.cs', isDirectory: false },
  { path: 'Assets/Scripts/Player/PlayerMove.cs', isDirectory: false },
  { path: 'docs/game-design.md', isDirectory: false },
];
const index = createFuzzyIndex(items.map((item) => item.path));

describe('findItems', () => {
  it('finds items anywhere in the workspace, best first, folders too', () => {
    expect(findItems(index, items, 'gamemanager').map((item) => item.path)).toEqual(['Assets/Scripts/GameManager.cs']);
    expect(findItems(index, items, 'scripts')[0]).toEqual({ path: 'Assets/Scripts', isDirectory: true });
  });

  it('keeps to the limit, and finds nothing for an empty query', () => {
    expect(findItems(index, items, 'a', 2)).toHaveLength(2);
    expect(findItems(index, items, '  ')).toEqual([]);
  });
});
