/** A position in a text: zero-based line and character, as the editor takes them. */
interface TextPosition {
  line: number;
  character: number;
}

/** One replacement of a range of the text, in the editor's terms. */
export interface TextReplacement {
  range: { start: TextPosition; end: TextPosition };
  newText: string;
}

/**
 * The single edit that turns `before` into `after`, replacing only the lines between their common first and last
 * lines, so the editor keeps the caret, the scroll and an undo step that matches what changed. Null when equal.
 */
export function replacementEdit(before: string, after: string): TextReplacement | null {
  if (before === after) return null;
  const old = splitLines(before);
  const next = splitLines(after);
  let common = 0;
  while (common < old.length && common < next.length && old[common] === next[common]) common++;
  let trailing = 0;
  while (trailing < old.length - common && trailing < next.length - common && old[old.length - 1 - trailing] === next[next.length - 1 - trailing]) trailing++;
  const endLine = old.length - trailing;
  return {
    range: { start: { line: common, character: 0 }, end: endLine < old.length ? { line: endLine, character: 0 } : endOf(before, old) },
    newText: next.slice(common, next.length - trailing).join(''),
  };
}

/** The lines of a text, each with its line break (the last one has none when the text doesn't end with one). */
function splitLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function endOf(text: string, lines: string[]): TextPosition {
  if (text === '' || text.endsWith('\n')) return { line: lines.length, character: 0 };
  return { line: lines.length - 1, character: lines.at(-1)!.length };
}
