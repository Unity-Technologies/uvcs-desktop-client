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
 * read, so every change either tells users what it delivers or says why it doesn't, and one with a picture left
 * where nobody placed it (`misplacedPicture`). It reads Markdown lines rather than parsing Markdown, so it needs no
 * package: only what Node runs as it is.
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
/** A Markdown picture, `![alt](url)`, or an HTML one, `<img …>`, as `gh --attach` and GitHub's editor write them. */
const PICTURE = /!\[[^\]]*\]\([^)]*\)|<img\b/i;
/** A Markdown picture's source, which `gh --attach` turns into the uploaded file's https link. */
const PICTURE_SOURCE = /!\[[^\]]*\]\(\s*<?([^)\s>]*)/g;
/** A video `gh --attach` uploads: its link alone on a line (videos take no alt text), which GitHub plays. */
const VIDEO_LINK = /^\s*https:\/\/github\.com\/user-attachments\/assets\/\S+\s*$/;
/** Inline code, `…` or ``…``: a picture written in it is shown as text. */
const CODE_SPAN = /(`+)[^`][\s\S]*?\1/g;
/**
 * The line an agent closes a body with ("🤖 Generated with [Claude Code](…)"), after the last section: `gh` appends
 * unreferenced attachments after it.
 */
const CLOSING_LINE = /^\W*Generated with\b/;
/** The template's last section, which holds links to issues, never a picture. */
const LAST_SECTION = /^##\s+Fixed issues\s*$/i;
/** What the pull request template asks to be replaced (`.github/pull_request_template.md`). */
const TEMPLATE_PLACEHOLDER = /<what users can now do>|<A sentence or two\b|<why>/;

const ATTACH_IT = 'attach it with `gh --attach`, which uploads it and puts its link where the body references it.';
const PLACE_IT =
  '`gh --attach` puts a file the body doesn\'t reference there: reference it where it belongs, inside "## Release note" ' +
  'or under "Behavior with this pull request".';

const FORMAT ='Start it with "### New:", "### Improved:" or "### Fixed:" and a title, then a description; or write "None:" and why users have nothing to read.';

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

/**
 * What the Release note workflow checks: the note (`readReleaseNote`), then the body's pictures (`misplacedPicture`).
 * A release's notes read merged pull requests with `readReleaseNote` alone, so a body written before the picture
 * rule still gives its note.
 */
export function checkPullRequestBody(body: string): ReleaseNoteReading {
  const reading = readReleaseNote(body);
  if ('problem' in reading) return reading;
  const misplaced = misplacedPicture(body);
  return misplaced === null ? reading : { problem: misplaced };
}

/**
 * Why a body's picture or video is wrong, or null: one left where nobody placed it, or one never uploaded.
 * `gh --attach` appends a file the body doesn't reference after everything else, past the closing line or in the
 * last section, where What's New never shows it and reviewers find it outside every section; and a reference to a
 * local file `gh` wasn't given stays a broken picture. Whether a note has a picture at all is the release-notes
 * skill's call, never this check's. A picture written as code (in backticks or a fence) is text, not a picture.
 */
export function misplacedPicture(body: string): string | null {
  const lines = body.replace(/\r\n?/g, '\n').replace(COMMENT, '').split('\n');
  const outside = outsideCodeIndexes(lines);
  // Only past the last section is "Generated with" the closing line: earlier, it is a sentence of the body.
  const lastSection = outside.filter((index) => NEXT_SECTION.test(lines[index]!)).at(-1) ?? -1;
  let section = '';
  let closed = false;
  for (const index of outside) {
    const line = lines[index]!;
    const text = line.replace(CODE_SPAN, '');
    if (NEXT_SECTION.test(line)) section = line;
    if (index > lastSection && CLOSING_LINE.test(line)) closed = true;
    const unattached = unattachedSource(text);
    if (unattached !== null) return `A picture shows a file that was never uploaded (${unattached}): ${ATTACH_IT}`;
    const showsPicture = PICTURE.test(text) || VIDEO_LINK.test(text);
    const atTheEnd = closed || LAST_SECTION.test(section);
    if (showsPicture && atTheEnd) return `A picture sits at the end of the body. ${PLACE_IT}`;
  }
  return null;
}

/** The source of a Markdown picture on this line that isn't a web address, such as `./shot.png`, or null. */
function unattachedSource(line: string): string | null {
  for (const [, source = ''] of line.matchAll(PICTURE_SOURCE)) {
    if (!/^https:\/\//i.test(source)) return source;
  }
  return null;
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
  const reading = checkPullRequestBody(process.env.PULL_REQUEST_BODY ?? '');
  console.log(describeReading(reading));
  if ('problem' in reading) process.exitCode = 1;
}
