import { useEffect, useRef } from 'react';
import { successorKey, type SelectionState } from '../../lib/selection';

interface KeepRowSelectedOptions {
  /** Off, a table may show with nothing selected. */
  enabled: boolean;
  orderedKeys: readonly string[];
  isShown: (key: string) => boolean;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  /** Moves the keyboard to the row selected (a state setter: stable). */
  focusRow: (key: string) => void;
}

/**
 * Selects a row whenever no shown row is selected: the one that took the place of a selected row that went away
 * (deleted, filtered out; `successorKey`), or the first. A details panel beside the table always has something to show.
 */
export function useKeepRowSelected({ enabled, orderedKeys, isShown, selection, onSelectionChange, focusRow }: KeepRowSelectedOptions): void {
  const firstKey = orderedKeys[0];
  const anchorShown = selection.anchor !== null && isShown(selection.anchor);
  // The rows before they last changed: where a selected row that went away was.
  const previousKeys = useRef<readonly string[]>([]);

  useEffect(() => {
    if (!enabled || firstKey === undefined || anchorShown) return;
    const next = successorKey(previousKeys.current, orderedKeys, selection.anchor) ?? firstKey;
    focusRow(next);
    onSelectionChange({ selected: new Set([next]), anchor: next });
    // Only when the answer can change: rows arriving, the selected row going away.
  }, [enabled, firstKey, anchorShown, onSelectionChange]);

  useEffect(() => {
    previousKeys.current = orderedKeys;
  }, [orderedKeys]);
}
