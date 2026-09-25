import type { GraphLayout } from '../model/layoutGraph';

const nextColumnsByLayout = new WeakMap<GraphLayout, Int32Array>();

/**
 * For each column, the column of the next changeset on the same row (-1 when it is the last one).
 * Tells how much room a changeset has for its comment. Computed once per layout.
 */
export function nextColumnOnRow(layout: GraphLayout, column: number): number {
  let nextColumns = nextColumnsByLayout.get(layout);
  if (!nextColumns) {
    nextColumns = computeNextColumns(layout);
    nextColumnsByLayout.set(layout, nextColumns);
  }
  return nextColumns[column] ?? -1;
}

function computeNextColumns(layout: GraphLayout): Int32Array {
  const next = new Int32Array(layout.nodesByColumn.length).fill(-1);
  const lastSeenByRow = new Map<number, number>();
  for (let column = layout.nodesByColumn.length - 1; column >= 0; column--) {
    const row = layout.nodesByColumn[column]!.row;
    next[column] = lastSeenByRow.get(row) ?? -1;
    lastSeenByRow.set(row, column);
  }
  return next;
}
