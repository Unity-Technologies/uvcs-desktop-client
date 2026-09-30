export interface SelectionState {
  selected: ReadonlySet<string>;
  /** The item a Shift-click range starts from. */
  anchor: string | null;
}

export const EMPTY_SELECTION: SelectionState = { selected: new Set(), anchor: null };

/** Only this row selected, and ranges start from it. */
export function singleSelection(key: string): SelectionState {
  return { selected: new Set([key]), anchor: key };
}

interface ClickModifiers {
  shift: boolean;
  toggle: boolean;
}

/**
 * The row keyboard moves go from: the one last moved to or clicked while it's shown and selected, else the anchor.
 * A selection set from outside the list (a row just created) holds no such row, so focus follows it.
 */
export function focusedKeyOf(movedTo: string | null, state: SelectionState, isShown: (key: string) => boolean): string | null {
  return movedTo !== null && isShown(movedTo) && state.selected.has(movedTo) ? movedTo : state.anchor;
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

  return singleSelection(key);
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
  return { state: singleSelection(next), focused: next };
}

function range(orderedKeys: readonly string[], from: string, to: string): string[] {
  const start = orderedKeys.indexOf(from);
  const end = orderedKeys.indexOf(to);
  if (start === -1 || end === -1) return [to];
  return orderedKeys.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/**
 * The row to select once the selected one is gone (deleted, hidden, filtered out): the first one after it that is still
 * shown, else the last one before it, so the selection stays where the user was. The first row when it was never shown.
 */
export function successorKey(previousKeys: readonly string[], shownKeys: readonly string[], goneKey: string | null): string | undefined {
  const shown = new Set(shownKeys);
  const index = goneKey === null ? -1 : previousKeys.indexOf(goneKey);
  if (index === -1) return shownKeys[0];
  return previousKeys.slice(index + 1).find((key) => shown.has(key)) ?? previousKeys.slice(0, index).findLast((key) => shown.has(key)) ?? shownKeys[0];
}
