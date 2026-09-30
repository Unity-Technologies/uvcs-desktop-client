import { singleSelection, type SelectionState } from '../../lib/selection';

/**
 * The selection that picks a row just created, once the refreshed list shows it; null while it doesn't yet (the list
 * refreshes after the dialog closes) or when nothing waits to be selected.
 */
export function selectCreated(shownKeys: readonly string[], createdKey: string | null): SelectionState | null {
  if (createdKey === null || !shownKeys.includes(createdKey)) return null;
  return singleSelection(createdKey);
}
