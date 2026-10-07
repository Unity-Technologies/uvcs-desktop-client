import { useEffect, useRef } from 'react';
import { singleSelection, type SelectionState } from '../../lib/selection';
import { rowKeyAfterLayout } from './selectionFollowsItem';

/**
 * Keeps the selection on the item it was made on when the rows are laid out again (`rowKeyAfterLayout`). Only a new
 * selection says which item it is on (`selectedItemKey`, read when `selectedKey` changes); a new layout (`rowKeyOf`)
 * keeps the item it had.
 */
export function useSelectionFollowsItem(
  selectedKey: string | null,
  selectedItemKey: string | undefined,
  selection: SelectionState,
  setSelection: (selection: SelectionState) => void,
  isListed: (itemKey: string) => boolean,
  rowKeyOf: (itemKey: string) => string,
): void {
  const itemKey = useRef<string | undefined>(undefined);
  const latest = useRef({ selection, setSelection, isListed });
  latest.current = { selection, setSelection, isListed };
  useEffect(() => {
    itemKey.current = selectedItemKey;
  }, [selectedKey]); // A new selection, not a new layout, says which item it is on.
  useEffect(() => {
    const { selection: current, setSelection: select, isListed: listed } = latest.current;
    const rowKey = rowKeyAfterLayout(itemKey.current, current, listed, rowKeyOf);
    if (rowKey !== null) select(singleSelection(rowKey));
  }, [rowKeyOf]); // Each new layout of the rows, and only then.
}
