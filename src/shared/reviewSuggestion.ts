/**
 * A change request's suggested change (docs/features/code-reviews.md "Suggested changes"), written as GitHub writes one:
 * a fence whose language is `suggestion`, holding the lines that replace the commented one. It is plain text in the
 * comment, so every other client shows it as a code block, and `cm` and the server know nothing of it.
 *
 * Only the first such fence of a comment is its suggestion, as GitHub takes one per comment; any other reads as code.
 * Only a fence of the comment's own (not inside a quote, a list or another fence) counts, as it shows on its own.
 */
export interface Suggestion {
  /** The lines that take the commented line's place, as written (their indentation kept): none deletes it. */
  lines: string[];
}

/** The language a fence names to suggest a change, as its info string's first word. */
export const SUGGESTION_LANGUAGE = 'suggestion';

/** A fence opening: up to three spaces, three or more backticks or tildes, then its info string (`suggestion title`). */
const OPENING_FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

/**
 * The suggestion a comment's text holds, or none. Read as CommonMark reads fences: closed by a fence of the same
 * character at least as long, or else running to the text's end; each line loses as much indentation as the opening
 * fence had, and keeps the rest. Line ends are `\n` or `\r\n`, as the text was written.
 */
export function suggestionOf(text: string): Suggestion | null {
  const lines = text.split(/\r?\n/);
  let index = 0;
  while (index < lines.length) {
    const opening = OPENING_FENCE.exec(lines[index]!);
    if (!opening || !isOpeningInfo(opening[2]!, opening[3]!)) {
      index++;
      continue;
    }
    const [, indent, fence, info] = opening as unknown as [string, string, string, string];
    const closing = closingIndexOf(lines, index + 1, fence);
    if (infoLanguage(info) === SUGGESTION_LANGUAGE) {
      const end = closing ?? withoutTrailingEmptyLine(lines);
      return { lines: lines.slice(index + 1, end).map((line) => withoutIndent(line, indent.length)) };
    }
    if (closing === null) return null;
    index = closing + 1;
  }
  return null;
}

/** Whether a text suggests a change: what a new comment's Suggest change offers once (`SuggestionButton`). */
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

function isOpeningInfo(fence: string, info: string): boolean {
  // A backtick fence's info string can't hold a backtick: "```a```" is inline code.
  return !(fence.startsWith('`') && info.includes('`'));
}

function infoLanguage(info: string): string | undefined {
  return info.trim().split(/\s+/)[0];
}

/** The line closing a fence opened as `fence`, from `start`, or null when none does. */
function closingIndexOf(lines: readonly string[], start: number, fence: string): number | null {
  const closing = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`);
  for (let index = start; index < lines.length; index++) if (closing.test(lines[index]!)) return index;
  return null;
}

/** An unclosed fence runs to the text's end, but not onto the empty "line" after a final line end. */
function withoutTrailingEmptyLine(lines: readonly string[]): number {
  return lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

function withoutIndent(line: string, indent: number): string {
  let removed = 0;
  while (removed < indent && line[removed] === ' ') removed++;
  return line.slice(removed);
}
