import type { LineRange } from '@shared/domain/reviewConversation';

/** "Line 13", "Lines 13–15": the lines a comment is on, or a suggestion replaces, as a sentence starts with them. */
export function rangeWords({ firstLine, lastLine }: LineRange): string {
  return lastLine > firstLine ? `Lines ${firstLine}–${lastLine}` : `Line ${firstLine}`;
}

/** "line 13", "lines 13–15": `rangeWords` inside a sentence. */
export function rangeWordsInline(range: LineRange): string {
  return rangeWords(range).toLowerCase();
}
