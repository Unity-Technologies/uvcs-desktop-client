/** A line of a text and the line end after it (`\r\n`, `\n`, `\r`, or none for a last line without one). */
interface EndedLine {
  text: string;
  end: string;
}

const BOM = '\uFEFF';

/**
 * A file's text with lines `firstLine` to `lastLine` (1-based) replaced by `lines`, everything else as it was: the other
 * lines and their own line ends, and a byte order mark. The new lines end as the last line replaced did (a file of
 * mixed line ends keeps that line's), a last line without one staying so; none deletes the lines with their line ends.
 * Null when the file is shorter than the lines.
 */
export function withLinesReplaced(text: string, firstLine: number, lastLine: number, lines: readonly string[]): string | null {
  const bom = text.startsWith(BOM) ? BOM : '';
  const all = endedLines(text.slice(bom.length));
  if (firstLine < 1 || lastLine < firstLine || lastLine > all.length) return null;
  const before = all.slice(0, firstLine - 1);
  const after = all.slice(lastLine);
  const replacedEnd = all[lastLine - 1]!.end;
  // The line end the new lines take between them: the last line replaced's, or, past a last line without one, the file's.
  const between = replacedEnd || before.at(-1)?.end || '\n';
  const added = lines.map((line, index): EndedLine => ({ text: line, end: index < lines.length - 1 ? between : replacedEnd }));
  const kept = [...before, ...added, ...after];
  // Deleting the last line, which had no line end: the line before it ends the file now, without its own.
  if (lines.length === 0 && after.length === 0 && replacedEnd === '' && kept.length > 0) kept[kept.length - 1] = { ...kept.at(-1)!, end: '' };
  return bom + kept.map((line) => line.text + line.end).join('');
}

/** A text's lines with their line ends; a text ending in a line end has no empty line after it. */
function endedLines(text: string): EndedLine[] {
  const lines: EndedLine[] = [];
  const pattern = /\r\n|\n|\r/g;
  let start = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    lines.push({ text: text.slice(start, match.index), end: match[0] });
    start = match.index + match[0].length;
  }
  if (start < text.length) lines.push({ text: text.slice(start), end: '' });
  return lines;
}
