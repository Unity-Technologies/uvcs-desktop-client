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
 *
 *   PULL_REQUEST_BODY="$(gh pr view --json body -q .body)" node scripts/build/releaseNote.ts
 */
import { resolve } from 'node:path';

export const RELEASE_NOTE_KINDS = ['New', 'Improved', 'Fixed'] as const;
export type ReleaseNoteKind = (typeof RELEASE_NOTE_KINDS)[number];

export type ReleaseNote = { kind: ReleaseNoteKind; title: string; description: string } | { kind: 'none'; reason: string };

export type ReleaseNoteReading = { note: ReleaseNote } | { problem: string };

const SECTION_HEADING = /^##\s+Release note\s*$/i;
const NEXT_SECTION = /^##\s/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const NOTE_HEADING = /^###\s+(\w+):\s*(.*?)\s*$/;
const ANY_NOTE_HEADING = /^###\s/;
/** A heading a release uses for itself, `#` or `##` (its groups), which a note's description must not hold. */
const RELEASE_HEADING = /^\s{0,3}#{1,2}(\s|$)/;
/** The line under a setext heading (`===` or `---` under text), a `#` or `##` heading too. */
const SETEXT_UNDERLINE = /^\s{0,3}(=+|-+)\s*$/;
const BARE_NONE = /^None:?$/;
const NONE = /^None:\s*([\s\S]*)$/;
const COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
/** What the pull request template asks to be replaced (`.github/pull_request_template.md`). */
const TEMPLATE_PLACEHOLDER = /<what users can now do>|<A sentence or two\b|<why>/;

const FORMAT = 'Start it with "### New:", "### Improved:" or "### Fixed:" and a title, then a description; or write "None:" and why users have nothing to read.';

export function readReleaseNote(body: string): ReleaseNoteReading {
  // Comments go first: what they hold (a "##" line, a fence) is never part of the note.
  const section = releaseNoteSection(body.replace(/\r\n?/g, '\n').replace(COMMENT, ''));
  if (section === null) return { problem: `The pull request has no "## Release note" section. ${FORMAT}` };
  const text = section.trim();
  if (text === '') return { problem: `The release note is empty. ${FORMAT}` };
  if (TEMPLATE_PLACEHOLDER.test(text)) return { problem: `The release note still holds the template's placeholders in "<…>": replace them. ${FORMAT}` };
  if (BARE_NONE.test(text)) return { problem: 'The release note says "None" without saying why users have nothing to read.' };

  const none = text.match(NONE);
  return none ? noneOf(none[1]!) : noteOf(text);
}

/** "None:" and its reason: one line, so a note written under it isn't dropped without a word. */
function noneOf(reason: string): ReleaseNoteReading {
  if (/\n\s*\n/.test(reason.trim())) {
    return { problem: 'A release note that says "None:" gives its reason in one line, and holds no note under it.' };
  }
  return { note: { kind: 'none', reason: reason.trim() } };
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
  if (holdsReleaseHeading(rest)) {
    return { problem: 'The release note\'s description holds a "#" or "##" heading, which would read as a part of the release: use "####".' };
  }
  if (openFenceAtEnd(rest)) return { problem: 'The release note leaves a code block open: close it with the same fence that opened it.' };
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

function holdsReleaseHeading(lines: string[]): boolean {
  const outside = outsideCodeIndexes(lines);
  return outside.some((index) => {
    const line = lines[index]!;
    const above = lines[index - 1];
    const underlinesText = outside.includes(index - 1) && above !== undefined && above.trim() !== '' && !RELEASE_HEADING.test(above);
    return RELEASE_HEADING.test(line) || (SETEXT_UNDERLINE.test(line) && underlinesText);
  });
}

function outsideCode(lines: string[]): string[] {
  return outsideCodeIndexes(lines).map((index) => lines[index]!);
}

function outsideCodeIndexes(lines: string[]): number[] {
  return scanFences(lines).outside;
}

function openFenceAtEnd(lines: string[]): boolean {
  return scanFences(lines).open;
}

/**
 * The indexes of the lines outside fenced code blocks, where a "##" line is a heading and not code, and whether a
 * block is left open at the end. As in CommonMark, a fence closes only on the character that opened it, at least as
 * many times: "```" inside "~~~" is code.
 */
function scanFences(lines: string[]): { outside: number[]; open: boolean } {
  const outside: number[] = [];
  let openFence: string | null = null;
  lines.forEach((line, index) => {
    const fence = line.match(FENCE)?.[1];
    if (openFence === null && fence) openFence = fence;
    else if (openFence !== null && fence && fence[0] === openFence[0] && fence.length >= openFence.length) openFence = null;
    else if (openFence === null) outside.push(index);
  });
  return { outside, open: openFence !== null };
}

/** What CI prints: the note it read, or what is wrong with it (and a failure). */
function describeReading(reading: ReleaseNoteReading): string {
  if ('problem' in reading) return reading.problem;
  const { note } = reading;
  return note.kind === 'none' ? `No release note: ${note.reason}` : `${note.kind}: ${note.title}\n\n${note.description}`;
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const reading = readReleaseNote(process.env.PULL_REQUEST_BODY ?? '');
  console.log(describeReading(reading));
  if ('problem' in reading) process.exitCode = 1;
}
