/** A rectangle in the window, as the editor measures text (`coordsAtPos`). */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where the bar goes, in the window: centered over the selection's first line, `gap` above it, or under its last
 * line when there's no room above; never past the window's edges.
 */
export function selectionBarPosition(selection: Box, bar: { width: number; height: number }, window: { width: number; height: number }, gap = 6): { left: number; top: number } {
  const margin = 8;
  const centered = (selection.left + selection.right) / 2 - bar.width / 2;
  const left = Math.min(Math.max(centered, margin), window.width - bar.width - margin);
  const above = selection.top - gap - bar.height;
  const top = above >= margin ? above : Math.min(selection.bottom + gap, window.height - bar.height - margin);
  return { left: Math.round(left), top: Math.round(top) };
}

/**
 * Where the suggestion list goes: under the line being typed, its start at the trigger's (`cs:`), or over the line
 * when there's no room under it; never past the window's edges.
 */
export function suggestionListPosition(trigger: Box, list: { width: number; height: number }, window: { width: number; height: number }, gap = 4): { left: number; top: number } {
  const margin = 8;
  const left = Math.min(Math.max(trigger.left, margin), window.width - list.width - margin);
  const below = trigger.bottom + gap;
  const top = below + list.height <= window.height - margin ? below : Math.max(trigger.top - gap - list.height, margin);
  return { left: Math.round(left), top: Math.round(top) };
}
