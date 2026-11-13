import { SUGGESTION_LANGUAGE, suggestionFenceIn } from './markdown';

/**
 * A change request's suggested change (docs/features/code-reviews.md "Suggested changes"), written as GitHub writes one:
 * a fence whose language is `suggestion`, holding the lines that replace the commented ones. It is plain text in the
 * comment, so every other client shows it as a code block, and `cm` and the server know nothing of it.
 *
 * Read by the one Markdown reader the app has (`suggestionFenceIn`), so a fence is a suggestion exactly where the
 * comment shows it as one (`suggestionBlockIndex`): the comment's first fence of its own in that language, as GitHub
 * takes one per comment; any other, or one in a quote, a list or another fence, is code.
 */
export interface Suggestion {
  /** The lines that take the commented ones' place, as written (their indentation kept): none deletes them. */
  lines: string[];
}

/** The suggestion a comment's text holds, or none. Line ends are `\n` or `\r\n`, as the text was written. */
export function suggestionOf(text: string): Suggestion | null {
  const fence = suggestionFenceIn(text);
  if (!fence) return null;
  // An empty fence and one holding an empty line both read as an empty text: the count of lines tells them apart.
  return { lines: fence.lineCount === 0 ? [] : fence.text.split(/\r?\n/) };
}

/** Whether a text suggests a change: what a new comment's Suggest change offers once (`suggestButtonOf`). */
export function holdsSuggestion(text: string): boolean {
  return suggestionOf(text) !== null;
}

/**
 * The fence that suggests `lines`, as the composer inserts it: three backticks, or one more than the longest run of
 * them in the lines, so a line of code holding its own fence never closes it.
 */
export function suggestionFence(lines: readonly string[]): string {
  const longestRun = Math.max(0, ...lines.flatMap((line) => (line.match(/`+/g) ?? []).map((run) => run.length)));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return [`${fence}${SUGGESTION_LANGUAGE}`, ...lines, fence].join('\n');
}

/**
 * A comment being written with a suggestion of `lines` inserted at `offset` (the caret), on lines of its own, and where
 * the caret then goes: at the end of the suggested lines, ready to change them.
 */
export function withSuggestionAt(text: string, offset: number, lines: readonly string[]): { text: string; caret: number } {
  const at = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const opening = before === '' || before.endsWith('\n') ? '' : '\n';
  const closing = after === '' || after.startsWith('\n') ? '' : '\n';
  const fence = suggestionFence(lines);
  const caret = before.length + opening.length + fence.length - fence.slice(fence.lastIndexOf('\n')).length;
  return { text: `${before}${opening}${fence}${closing}${after}`, caret };
}
