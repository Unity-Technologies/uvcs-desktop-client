import { navigationTarget } from '../lib/listNavigation';

/** What a key pressed in a pick list's search field does to its rows. */
export type PickListKeyAction = { kind: 'move'; to: number } | { kind: 'pick'; index: number } | { kind: 'type' };

/**
 * The field keeps the keys: ↑↓ and Page Up / Down move through the rows, Enter picks the row they're on (the first
 * one while typing); every other key is typed.
 */
export function pickListKeyAction(key: string, active: number, rowCount: number): PickListKeyAction {
  if (rowCount === 0) return { kind: 'type' };
  if (key === 'Enter') return { kind: 'pick', index: Math.max(0, Math.min(active, rowCount - 1)) };
  const to = navigationTarget(key, active, rowCount);
  return to === null ? { kind: 'type' } : { kind: 'move', to };
}
