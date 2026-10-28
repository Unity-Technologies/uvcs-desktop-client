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
/**
 * Whether a press puts the caret where it lands: one with the main button in the field's box but not on its text
 * (under the last line, the padding), as on the text, as the editor is only as tall as its text. A press on the text
 * is the editor's own, one on a control in the box (the toolbar, the corner button, a chip's link) is the control's,
 * and one from a popup outside the box (React hands the field its portals' presses) is the popup's.
 */
export function pressPlacesCaret(press: { button: number; onText: boolean; inBox: boolean; onControl: boolean }): boolean {
  return press.button === 0 && press.inBox && !press.onText && !press.onControl;
}

export function pressHidesBar(field: { contains: (node: never) => boolean }, target: unknown): boolean {
  return field.contains(target as never);
}
