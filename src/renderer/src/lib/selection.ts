export interface SelectionState {
  selected: ReadonlySet<string>;
  /** The item a Shift-click range starts from. */
  anchor: string | null;
}

export const EMPTY_SELECTION: SelectionState = { selected: new Set(), anchor: null };

interface ClickModifiers {
  shift: boolean;
  toggle: boolean;
}

/** Applies a click with platform selection semantics: plain, ⌘/Ctrl (toggle) and Shift (range). */
export function selectOnClick(
  state: SelectionState,
  key: string,
  orderedKeys: readonly string[],
  { shift, toggle }: ClickModifiers,
): SelectionState {
  if (shift && state.anchor !== null) {
    return { selected: new Set(range(orderedKeys, state.anchor, key)), anchor: state.anchor };
  }

  if (toggle) {
    const selected = new Set(state.selected);
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    return { selected, anchor: key };
  }

  return { selected: new Set([key]), anchor: key };
}

/**
 * Moves the selection `step` items from the focused one (arrows: ±1, PageUp/PageDown: ±a page, Home/End: ±Infinity),
 * clamped to the ends; Shift extends it from the anchor.
 */
export function selectOnArrow(
  state: SelectionState,
  orderedKeys: readonly string[],
  step: number,
  extend: boolean,
  focusedKey: string | null,
): { state: SelectionState; focused: string } | null {
  if (orderedKeys.length === 0) return null;

  const currentIndex = focusedKey === null ? -1 : orderedKeys.indexOf(focusedKey);
  const nextIndex = Math.min(orderedKeys.length - 1, Math.max(0, currentIndex + step));
  const next = orderedKeys[nextIndex]!;

  if (extend && state.anchor !== null) {
    return { state: { selected: new Set(range(orderedKeys, state.anchor, next)), anchor: state.anchor }, focused: next };
  }
  return { state: { selected: new Set([next]), anchor: next }, focused: next };
}

function range(orderedKeys: readonly string[], from: string, to: string): string[] {
  const start = orderedKeys.indexOf(from);
  const end = orderedKeys.indexOf(to);
  if (start === -1 || end === -1) return [to];
  return orderedKeys.slice(Math.min(start, end), Math.max(start, end) + 1);
}
