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
