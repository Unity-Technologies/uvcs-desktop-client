/** A tree row as ← and → see it: how deep it sits, and whether it is a folder and open. */
export interface TreeArrowRow {
  depth: number;
  isFolder: boolean;
  isExpanded: boolean;
}

/** What ← or → does on the row at `index`, as in any tree: open or close a folder, or step into it or out to its parent. */
export type TreeArrowMove = { kind: 'toggle' } | { kind: 'moveBy'; step: number };

export function treeArrowMove(rows: readonly TreeArrowRow[], index: number, key: 'ArrowLeft' | 'ArrowRight'): TreeArrowMove | null {
  const row = rows[index];
  if (!row) return null;
  if (key === 'ArrowRight') {
    if (!row.isFolder) return null;
    if (!row.isExpanded) return { kind: 'toggle' };
    return (rows[index + 1]?.depth ?? -1) > row.depth ? { kind: 'moveBy', step: 1 } : null;
  }
  if (row.isFolder && row.isExpanded) return { kind: 'toggle' };
  for (let parent = index - 1; parent >= 0; parent--) {
    if (rows[parent]!.depth < row.depth) return { kind: 'moveBy', step: parent - index };
  }
  return null;
}
