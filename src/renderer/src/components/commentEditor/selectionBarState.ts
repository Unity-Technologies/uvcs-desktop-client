import type { EditorState } from '@codemirror/state';
import { isInCode } from './formatCommands';

/**
 * Whether the bar shows: text is selected in the focused field, the pointer let go (no bar flickering along a drag),
 * and not in a code block, where formatting is the code's own text. Focus mode has its toolbar instead.
 */
export function selectionBarShows(state: EditorState, focused: boolean, pointerDown: boolean, focusMode: boolean): boolean {
  const main = state.selection.main;
  return focused && !pointerDown && !focusMode && !main.empty && !isInCode(state, main.from);
}

/**
 * Whether a press hides the bar, as a selection is being made: a press in the field's own DOM. React hands the field
 * a press on its portals too (the bar, the suggestions, a chip's card), and the bar hiding under its own button's
 * press left the button's click nothing to run on.
 */
export function pressHidesBar(field: { contains: (node: never) => boolean }, target: unknown): boolean {
  return field.contains(target as never);
}
