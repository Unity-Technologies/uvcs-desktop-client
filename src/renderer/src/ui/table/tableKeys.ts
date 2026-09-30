type ArrowKeyEvent = Pick<KeyboardEvent, 'key' | 'altKey' | 'metaKey' | 'ctrlKey' | 'shiftKey'>;

interface StepOptions {
  /** Rows a PageUp or PageDown moves (`rowsPerPage`). */
  pageRows: number;
  /** J and K move like ↓ and ↑. */
  letterMoves: boolean;
}

/**
 * How many rows a key moves a table's selection: ±1 for the arrows (and J/K with `letterMoves`), a page for PageUp and
 * PageDown, ±Infinity for Home and End (`selectOnArrow` clamps them to the ends); undefined for any other key. Shift
 * still moves (it extends the selection); ⌥ never does, as ⌥↑ ⌥↓ move through the changes of the diff beside the list
 * (`useChangeNavigation`).
 */
export function selectionStep(event: ArrowKeyEvent, { pageRows, letterMoves }: StepOptions): number | undefined {
  if (event.altKey) return undefined;
  const plain = !event.metaKey && !event.ctrlKey && !event.shiftKey;
  const steps: Record<string, number> = {
    ArrowDown: 1,
    ArrowUp: -1,
    PageDown: pageRows,
    PageUp: -pageRows,
    Home: -Infinity,
    End: Infinity,
    ...(letterMoves && plain && { j: 1, k: -1 }),
  };
  return steps[event.key];
}

/** The rows a PageUp or PageDown moves: a viewport of them less one, so the row moved from stays in view; at least one. */
export function rowsPerPage(viewportHeight: number, rowHeight: number): number {
  return Math.max(1, Math.floor(viewportHeight / rowHeight) - 1);
}
