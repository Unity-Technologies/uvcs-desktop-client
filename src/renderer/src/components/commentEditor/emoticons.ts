/**
 * The emoticons a comment field turns into their emoji as they're typed (docs/features/rich-comments.md, "Emoticons"),
 * each to the emoji Slack and GitHub show for it. Left out on purpose, as text a comment means as written: `:/` (a
 * path's start), `XD` (a word: Adobe XD), `<3` (a comparison: `n <3`), `8)` and `B-)` (a numbered or lettered
 * list's item), `:|` (a table's alignment).
 */
export const EMOTICON_EMOJI: Readonly<Record<string, string>> = {
  ':-)': '\u{1F642}',
  ':)': '\u{1F642}',
  ';-)': '\u{1F609}',
  ';)': '\u{1F609}',
  ':-D': '\u{1F604}',
  ':D': '\u{1F604}',
  ':-(': '\u{1F641}',
  ':(': '\u{1F641}',
  ":'(": '\u{1F622}',
  ':-P': '\u{1F61B}',
  ':P': '\u{1F61B}',
  ':-p': '\u{1F61B}',
  ':p': '\u{1F61B}',
  ':-O': '\u{1F62E}',
  ':O': '\u{1F62E}',
  ':-o': '\u{1F62E}',
  ':o': '\u{1F62E}',
  ':-|': '\u{1F610}',
  ':-/': '\u{1F615}',
};

/** An emoticon found at the end of a text: where it starts in that text, and its emoji. */
export interface EmoticonEnding {
  from: number;
  emoticon: string;
  emoji: string;
}

/**
 * An emoticon standing alone at the text's end: at its start, or after a space or an opening bracket. Never inside a
 * word or an address (`a:-)`, `http://host:8080`, `/:-)`). Longest first, so `:-)` is never read as a `-` and `:)`.
 */
const ENDING = new RegExp(`(?<![^\\s([{])(${Object.keys(EMOTICON_EMOJI).sort((a, b) => b.length - a.length).map(escaped).join('|')})$`, 'u');

/** The emoticon the text ends with, standing alone, or null. */
export function emoticonEnding(text: string): EmoticonEnding | null {
  const match = ENDING.exec(text);
  if (!match) return null;
  const emoticon = match[1]!;
  return { from: match.index, emoticon, emoji: EMOTICON_EMOJI[emoticon]! };
}

/** The keys typed after an emoticon that turn it into its emoji: a space, or a sentence's punctuation (Enter too: `emoticonTyping`). */
export function endsEmoticon(typed: string): boolean {
  return typed === ' ' || typed === '.' || typed === ',' || typed === '!' || typed === '?';
}

/**
 * Whether a line's text, up to where it ends, is inside an inline code span still being typed: a run of backticks
 * no run of the same length has closed yet (as Markdown pairs them). The syntax tree can't tell: until it's closed,
 * a backtick reads as text.
 */
export function insideOpenCodeSpan(text: string): boolean {
  let open: number | null = null;
  for (const [run] of text.matchAll(/`+/g)) {
    if (open === null) open = run.length;
    else if (run.length === open) open = null;
  }
  return open !== null;
}

/**
 * Whether the line is all a table's alignments (`| :-| -: |`) under a line with cells: its delimiter row, typed or
 * whole. The syntax tree can't tell while it's typed: until its cells match the header's, it reads as a paragraph.
 */
export function isTableDelimiterRow(line: string, previousLine: string | null): boolean {
  return /^[\s|:-]*\|[\s|:-]*$/.test(line) && previousLine !== null && previousLine.includes('|');
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
