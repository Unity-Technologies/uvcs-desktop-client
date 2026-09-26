import { diffArrays } from 'diff';

/**
 * Line breaks of texts the diffs show: LF, CRLF, and the lone CR of classic Mac OS files. Pierre and `diff` break lines
 * only at LF, so a file of lone CRs would show as one line: diffs show each lone CR as a LF (`shownText`), which keeps
 * the lines and their count, and edits go back to the file with its own line breaks (`diskText`).
 */

const LONE_CR = /\r(?!\n)/;
const LONE_CRS = /\r(?!\n)/g;
const BARE_LF = /(?:^|[^\r])\n/;
const LINES = /[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g;
/** Past this many lines told apart, edits in between aren't matched line by line (`diskText`). */
const MAX_MATCHED_EDITS = 2_000;

export type LineBreak = '\r\n' | '\r' | '\n';

export function hasLoneCr(text: string): boolean {
  return text.includes('\r') && LONE_CR.test(text);
}

/** The text as a diff shows it: every lone CR as a LF. The same text when it has none. */
export function shownText(text: string): string {
  return hasLoneCr(text) ? text.replace(LONE_CRS, '\n') : text;
}

/** The lines of a text, each with its line break (CRLF, CR or LF); the last one has none when the text doesn't end with one. */
export function splitLines(text: string): string[] {
  return text.match(LINES) ?? [];
}

/** The line break a line ends with, if any. */
export function lineBreakOf(line: string): LineBreak | '' {
  if (line.endsWith('\r\n')) return '\r\n';
  if (line.endsWith('\n')) return '\n';
  return line.endsWith('\r') ? '\r' : '';
}

/** Whether the text ends with a line break of any kind. */
export function endsWithLineBreak(text: string): boolean {
  return text.endsWith('\n') || text.endsWith('\r');
}

/** The line break most of the lines end with (LF on a tie); none when no line has one. */
export function dominantLineBreak(lines: string[]): LineBreak | undefined {
  const counts = { '\n': 0, '\r\n': 0, '\r': 0 };
  for (const line of lines) {
    const lineBreak = lineBreakOf(line);
    if (lineBreak) counts[lineBreak]++;
  }
  const [most, count] = (Object.entries(counts) as [LineBreak, number][]).reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  return count > 0 ? most : undefined;
}

/**
 * The text to write for `shown`, the file's text as the diff showed it (typed into, lines discarded) when it was
 * `disk`. The lines kept keep their line break from `disk`; new lines ending with a LF take the file's most common
 * line break, so a file of lone CRs stays one. Only a file with lone CRs needs it: any other is written as shown.
 */
export function diskText(shown: string, disk: string): string {
  if (!hasLoneCr(disk)) return shown;
  const diskLines = splitLines(disk);
  const diskShown = diskLines.map((line) => (line.endsWith('\r') ? `${line.slice(0, -1)}\n` : line));
  const shownLines = splitLines(shown);
  const lineBreak = dominantLineBreak(diskLines) ?? '\n';
  const adopt = (line: string): string => (lineBreakOf(line) === '\n' ? line.slice(0, -1) + lineBreak : line);

  let start = 0;
  while (start < diskLines.length && start < shownLines.length && diskShown[start] === shownLines[start]) start++;
  let end = 0;
  while (end < diskLines.length - start && end < shownLines.length - start && diskShown[diskLines.length - 1 - end] === shownLines[shownLines.length - 1 - end]) end++;

  const middle: string[] = [];
  const changes = diffArrays(diskShown.slice(start, diskLines.length - end), shownLines.slice(start, shownLines.length - end), { maxEditLength: MAX_MATCHED_EDITS });
  if (changes) {
    let diskIndex = start;
    for (const change of changes) {
      if (change.removed) diskIndex += change.count;
      else if (change.added) middle.push(...change.value.map(adopt));
      else {
        middle.push(...diskLines.slice(diskIndex, diskIndex + change.count));
        diskIndex += change.count;
      }
    }
  } else {
    middle.push(...shownLines.slice(start, shownLines.length - end).map(adopt));
  }
  return [...diskLines.slice(0, start), ...middle, ...diskLines.slice(diskLines.length - end)].join('');
}

/**
 * Whether one text breaks its lines with lone CRs only and the other with LFs only. Both show their line breaks as LF,
 * yet they differ: a diff that recognizes line endings tells them apart (`lineDiffOptions`). A text mixing both can't
 * say which of its LFs were CRs, so it compares as shown.
 */
export function crAgainstLf(original: string, modified: string): boolean {
  const a = bareLineBreaks(original);
  const b = bareLineBreaks(modified);
  return (a === 'cr' && b === 'lf') || (a === 'lf' && b === 'cr');
}

function bareLineBreaks(text: string): 'cr' | 'lf' | 'both' | 'none' {
  const cr = hasLoneCr(text);
  const lf = BARE_LF.test(text);
  if (cr && lf) return 'both';
  return cr ? 'cr' : lf ? 'lf' : 'none';
}
