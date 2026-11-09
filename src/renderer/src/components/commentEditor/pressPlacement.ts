/**
 * Whether a press puts the caret where it lands: one with the main button in the field's box but not on its text
 * (under the last line, the padding), as on the text, as the editor is only as tall as its text. A press on the text
 * is the editor's own, one on a control in the box (the toolbar, the corner button, a chip's link) is the control's,
 * and one from a popup outside the box (React hands the field its portals' presses) is the popup's.
 */
export function pressPlacesCaret(press: { button: number; onText: boolean; inBox: boolean; onControl: boolean }): boolean {
  return press.button === 0 && press.inBox && !press.onText && !press.onControl;
}
