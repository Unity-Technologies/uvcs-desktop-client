import { useCallback, useEffect, useState } from 'react';
import { focusMain } from '../../lib/mainFocus';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { historyRowKey, type HistoryRow } from './historyRows';

interface HistorySelectionOptions {
  /** The row the history opens on (`initialHistoryRow`), once it's read. */
  initialKey: string | null | undefined;
  /** The rows the list shows: a row selected from elsewhere that the filters hide clears them. */
  visible: readonly HistoryRow[];
  clearFilters: () => void;
}

const onlyRow = (key: string): SelectionState => ({ selected: new Set([key]), anchor: key });

/**
 * The rows selected in the history, and the trail "Annotate before this change" leaves for Back. Picking in the list
 * starts the trail over; a row selected from the pane (an annotated block, walking back) is revealed in the list, and
 * the keyboard goes with it, as the pane shows another revision now.
 */
export function useHistorySelection({ initialKey, visible, clearFilters }: HistorySelectionOptions) {
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [trail, setTrail] = useState<string[]>([]);
  const [revealKey, setRevealKey] = useState<string | null>(null);

  useEffect(() => {
    if (selection.anchor === null && initialKey) {
      setSelection(onlyRow(initialKey));
      setRevealKey(initialKey);
    }
  }, [selection.anchor, initialKey]);

  const selectFromPane = useCallback(
    (key: string): void => {
      if (!visible.some((row) => historyRowKey(row) === key)) clearFilters();
      setSelection(onlyRow(key));
      setRevealKey(key);
      focusMain(document);
    },
    [visible, clearFilters],
  );

  /** Selects row `key` from the pane anew, forgetting the trail (a row's "Annotate this revision"). */
  const selectAnew = useCallback(
    (key: string): void => {
      setTrail([]);
      selectFromPane(key);
    },
    [selectFromPane],
  );
  /** Selects the revision "before this change", leaving the one selected on the trail for Back. */
  const walkBackTo = useCallback(
    (key: string): void => {
      const current = selection.anchor;
      if (current) setTrail((walked) => [...walked, current]);
      selectFromPane(key);
    },
    [selection.anchor, selectFromPane],
  );

  return {
    selection,
    revealKey,
    /** The list's own selection: starts the trail over. */
    selectInList: (next: SelectionState): void => {
      setTrail([]);
      setSelection(next);
    },
    selectFromPane,
    selectAnew,
    walkBackTo,
    /** Back to the revision annotated before; none once the trail is empty. */
    back:
      trail.length > 0
        ? (): void => {
            setTrail(trail.slice(0, -1));
            selectFromPane(trail.at(-1)!);
          }
        : undefined,
  };
}
