import type { EditorState } from '@codemirror/state';
import { isInCode, type FormatCommandId } from './formatCommands';

/** What formats a field offers: a one-line field (a summary, a title) the inline ones, a comment of many lines all. */
export const INLINE_FORMATS: readonly FormatCommandId[] = ['bold', 'italic', 'strikethrough', 'code', 'link'];
export const EVERY_FORMAT: readonly FormatCommandId[] = [...INLINE_FORMATS, 'bullet', 'task', 'quote', 'codeBlock'];

export function formatsOf(singleLine: boolean): readonly FormatCommandId[] {
  return singleLine ? INLINE_FORMATS : EVERY_FORMAT;
}

/** The selection bar's words for each format: its tooltip, and its name for screen readers. */
export const FORMAT_LABELS: Record<FormatCommandId, string> = {
  bold: 'Bold',
  italic: 'Italic',
  strikethrough: 'Strikethrough',
  code: 'Code',
  link: 'Link',
  bullet: 'List',
  task: 'Task list',
  quote: 'Quote',
  codeBlock: 'Code block',
};

/**
 * Whether the bar shows: text is selected in the focused field, the pointer let go (no bar flickering along a drag),
 * and not in a code block, where formatting is the code's own text.
 */
export function selectionBarShows(state: EditorState, focused: boolean, pointerDown: boolean): boolean {
  const main = state.selection.main;
  return focused && !pointerDown && !main.empty && !isInCode(state, main.from);
}

/**
 * Whether a press hides the bar, as a selection is being made: a press in the field's own DOM. React hands the field
 * a press on its portals too (the bar, the suggestions, a chip's card), and the bar hiding under its own button's
 * press left the button's click nothing to run on.
 */
export function pressHidesBar(field: { contains: (node: never) => boolean }, target: unknown): boolean {
  return field.contains(target as never);
}
