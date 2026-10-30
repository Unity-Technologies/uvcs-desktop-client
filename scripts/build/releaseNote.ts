/**
 * A pull request's release note: what its body's "## Release note" section tells the app's users, written with the
 * release-notes skill (`.claude/skills/release-notes`). It is one note, a kind and a title on one line and a
 * description under it, or "None:" and why the pull request has nothing to tell users:
 *
 *   ## Release note
 *
 *   ### Fixed: Closing a window no longer stops what it's doing
 *
 *   If you close a window during an update or a checkin, the app now waits for it to finish.
 *
 * The Release note workflow (`.github/workflows/release-note.yml`) fails a pull request whose section this can't
 * read, so every change either tells users what it delivers or says why it doesn't. It reads Markdown lines rather
 * than parsing Markdown, so it needs no package: only what Node runs as it is.
 */

export const RELEASE_NOTE_KINDS = ['New', 'Improved', 'Fixed'] as const;
export type ReleaseNoteKind = (typeof RELEASE_NOTE_KINDS)[number];

export type ReleaseNote = { kind: ReleaseNoteKind; title: string; description: string } | { kind: 'none'; reason: string };

export type ReleaseNoteReading = { note: ReleaseNote } | { problem: string };

const SECTION_HEADING = /^##\s+Release note\s*$/i;
const NEXT_SECTION = /^##\s/;
const FENCE = /^\s*(```|~~~)/;
const NOTE_HEADING = /^###\s+(\w+):\s*(.*?)\s*$/;
const ANY_NOTE_HEADING = /^###\s/;
const NONE = /^None\b:?\s*(.*)$/is;
const COMMENT = /<!--[\s\S]*?-->/g;

const FORMAT = 'Start it with "### New:", "### Improved:" or "### Fixed:" and a title, then a description; or write "None:" and why users have nothing to read.';

export function readReleaseNote(body: string): ReleaseNoteReading {
  const section = releaseNoteSection(body.replace(/\r\n?/g, '\n'));
  if (section === null) return { problem: `The pull request has no "## Release note" section. ${FORMAT}` };
  const text = section.replace(COMMENT, '').trim();
  if (text === '') return { problem: `The release note is empty. ${FORMAT}` };

  const none = text.match(NONE);
  if (none) {
    const reason = none[1]!.trim();
    return reason ? { note: { kind: 'none', reason } } : { problem: 'The release note says "None" without saying why users have nothing to read.' };
  }
  return noteOf(text);
}

function noteOf(text: string): ReleaseNoteReading {
  const [headingLine = '', ...rest] = text.split('\n');
  const heading = headingLine.match(NOTE_HEADING);
  const kind = RELEASE_NOTE_KINDS.find((name) => name === heading?.[1]);
  if (!heading || !kind) return { problem: `The release note doesn't start with its kind: New:, Improved: or Fixed:. ${FORMAT}` };
  const title = heading[2]!;
  if (title === '') return { problem: `The release note has a kind but no title: write it after "### ${kind}:".` };
  if (outsideCode(rest).some((line) => ANY_NOTE_HEADING.test(line))) {
    return { problem: 'The release note holds more than one "###" heading: a pull request has one note, and its description uses "####" for headings.' };
  }
  const description = rest.join('\n').trim();
  if (description === '') return { problem: 'The release note has a title but no description: tell users what changed in a sentence or two under it.' };
  return { note: { kind, title, description } };
}

/** The lines of the "## Release note" section, up to the next "##" heading outside a code block; null without one. */
function releaseNoteSection(body: string): string | null {
  const lines = body.split('\n');
  const start = outsideCodeIndexes(lines).find((index) => SECTION_HEADING.test(lines[index]!));
  if (start === undefined) return null;
  const end = outsideCodeIndexes(lines).find((index) => index > start && NEXT_SECTION.test(lines[index]!));
  return lines.slice(start + 1, end).join('\n');
}

function outsideCode(lines: string[]): string[] {
  return outsideCodeIndexes(lines).map((index) => lines[index]!);
}

/** The indexes of the lines outside fenced code blocks, where a "##" line is a heading and not code. */
function outsideCodeIndexes(lines: string[]): number[] {
  const indexes: number[] = [];
  let inCode = false;
  lines.forEach((line, index) => {
    if (FENCE.test(line)) inCode = !inCode;
    else if (!inCode) indexes.push(index);
  });
  return indexes;
}
