import type { LineRange } from '@shared/domain/reviewConversation';

/** "Line 13", "Lines 13–15": the lines a comment is on, or a suggestion replaces, as a sentence starts with them. */
export function rangeWords({ firstLine, lastLine }: LineRange): string {
  return lastLine > firstLine ? `Lines ${firstLine}–${lastLine}` : `Line ${firstLine}`;
}

/** "line 13", "lines 13–15": `rangeWords` inside a sentence. */
export function rangeWordsInline(range: LineRange): string {
  return rangeWords(range).toLowerCase();
}

/** "42", "12-18": the lines after a file's name, as editors write them (`Player.cs:12-18`), and as keys name them. */
export function rangeSpan({ firstLine, lastLine }: LineRange): string {
  return lastLine > firstLine ? `${firstLine}-${lastLine}` : String(firstLine);
}
