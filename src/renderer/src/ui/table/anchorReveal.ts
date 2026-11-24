import type { SelectionState } from '../../lib/selection';

/**
 * What the table does about the selection kept from an earlier visit as its rows change: show it once its row is in
 * (`reveal`, until that worked), and again after the rows were all gone and came back, filters cleared (`forget`).
 */
export function anchorRevealStep(rowCount: number, revealed: boolean): 'forget' | 'reveal' | 'none' {
  if (rowCount === 0) return 'forget';
  return revealed ? 'none' : 'reveal';
}

/**
 * Whether the selection was set while the table was hidden, kept mounted with its view (`KeptView`): Show in Locks
 * selects a lock in a Locks view not shown, the one already selected too (`selectInView` sets a new selection). It
 * shows as the view shows again, as a selection kept from an earlier visit does. By the selection itself, not its
 * anchor: nothing else sets it while the view is hidden. `hiddenWith` is the one the table was hidden with; undefined
 * before it ever was.
 */
export function selectionSetWhileHidden(hiddenWith: SelectionState | undefined, selection: SelectionState): boolean {
  return hiddenWith !== undefined && hiddenWith !== selection;
}
