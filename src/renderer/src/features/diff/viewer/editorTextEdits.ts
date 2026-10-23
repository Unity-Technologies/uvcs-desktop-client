import { isEmptySpan, type TextSpan } from './textSpans';

/** An edit as Pierre's editor applies it (`Editor.applyEdits`'s `TextEdit`): the span replaced, against the text before every edit. */
export interface SpanEdit {
  range: TextSpan;
  newText: string;
}

/** Whether any selection holds text: what Delete acts on. */
export function holdsText(selections: readonly TextSpan[]): boolean {
  return selections.some((span) => !isEmptySpan(span));
}

/**
 * The menu's Delete: the text each selection holds goes, without the clipboard; a bare caret deletes nothing. Pierre's
 * `applyEdits` moves the carets to where their text was (`remapSelectionsAfterEdits`), and its history takes it back.
 */
export function deletionEdits(selections: readonly TextSpan[]): SpanEdit[] {
  return selections.filter((span) => !isEmptySpan(span)).map((range) => ({ range, newText: '' }));
}
