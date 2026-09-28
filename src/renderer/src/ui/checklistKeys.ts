/** What a key pressed in a filter checklist's search field does to its rows. */
export type ChecklistKeyAction = { kind: 'move'; to: number } | { kind: 'toggle'; index: number } | { kind: 'type' };

interface ChecklistKeyState {
  /** The row the arrows are on, -1 for none. */
  active: number;
  rowCount: number;
  /** Whether the last key moved through the rows: then Space toggles the row instead of typing a space. */
  browsing: boolean;
}

/**
 * The field keeps the keys: ↑↓ move through the rows, Enter toggles the row they're on (the first one while typing),
 * and Space toggles it too once the arrows moved there; every other key is typed, words and spaces alike.
 */
export function checklistKeyAction(key: string, { active, rowCount, browsing }: ChecklistKeyState): ChecklistKeyAction {
  if (rowCount === 0) return { kind: 'type' };
  if (key === 'ArrowDown') return { kind: 'move', to: Math.min(rowCount - 1, active + 1) };
  if (key === 'ArrowUp') return { kind: 'move', to: Math.max(0, active - 1) };
  if (key === 'Enter') return { kind: 'toggle', index: Math.max(0, Math.min(active, rowCount - 1)) };
  if (key === ' ' && browsing && active >= 0) return { kind: 'toggle', index: active };
  return { kind: 'type' };
}
