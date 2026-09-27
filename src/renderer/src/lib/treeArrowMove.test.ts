import { describe, expect, it } from 'vitest';
import { treeArrowMove, type TreeArrowRow } from './treeArrowMove';

// Assets (closed), src (open) > [a.ts, b.ts], readme.md
const rows: TreeArrowRow[] = [
  { depth: 0, isFolder: true, isExpanded: false },
  { depth: 0, isFolder: true, isExpanded: true },
  { depth: 1, isFolder: false, isExpanded: false },
  { depth: 1, isFolder: false, isExpanded: false },
  { depth: 0, isFolder: false, isExpanded: false },
];

describe('treeArrowMove', () => {
  it('opens a closed folder, then steps into it', () => {
    expect(treeArrowMove(rows, 0, 'ArrowRight')).toEqual({ kind: 'toggle' });
    expect(treeArrowMove(rows, 1, 'ArrowRight')).toEqual({ kind: 'moveBy', step: 1 });
    expect(treeArrowMove(rows, 2, 'ArrowRight')).toBeNull();
  });

  it('closes an open folder, and goes from a child up to its folder', () => {
    expect(treeArrowMove(rows, 1, 'ArrowLeft')).toEqual({ kind: 'toggle' });
    expect(treeArrowMove(rows, 3, 'ArrowLeft')).toEqual({ kind: 'moveBy', step: -2 });
    expect(treeArrowMove(rows, 4, 'ArrowLeft')).toBeNull();
  });
});
