import type { ReleaseNotes } from '@shared/domain/appUpdate';
import { plainText, type MarkdownBlock, type MarkdownInline } from '../../lib/markdown';
import { releaseNotesOutline, type ReleaseNotesPart } from '../../lib/releaseNotesHtml';

/** What a note is about, the group it's under: what's new, what got better, what got fixed, anything else. */
export type NoteKind = 'new' | 'improved' | 'fixed' | 'other';

/** The groups in the order a release lists them. */
export const NOTE_KINDS: readonly NoteKind[] = ['new', 'improved', 'fixed', 'other'];

export const NOTE_KIND_LABELS: Record<NoteKind, string> = { new: 'New', improved: 'Improved', fixed: 'Fixed', other: 'Other changes' };

/** One change, as a release's notes tell it: a title, and what to know about it (empty for a one-line change). */
export interface WhatsNewNote {
  kind: NoteKind;
  title: MarkdownInline[];
  description: MarkdownBlock[];
}

export interface WhatsNewRelease {
  version: string;
  releaseDate: string | null;
  /** What the release says before its first group, or all of it when it isn't written in groups (`plain`). */
  intro: MarkdownBlock[];
  notes: WhatsNewNote[];
  /** Written as plain Markdown, not in groups: its notes are its `intro`, and it has no notes to count or filter. */
  plain: boolean;
}

/**
 * Reads one release's notes, written as the Release workflow writes them: groups under level-2 headings named as
 * `NOTE_KIND_LABELS` are, each note a level-3 heading and its description (`releaseNotesOutline`). GitHub's generated
 * notes ("What's Changed", a list of pull requests) read as other changes, a note a pull request. Notes written any
 * other way read as plain Markdown. The closing "**Full Changelog**" line is left out either way: the dialog links to
 * every release instead.
 */
export function whatsNewRelease({ version, html, releaseDate }: ReleaseNotes): WhatsNewRelease {
  const parts = withoutChangelogLine(releaseNotesOutline(html));
  const base = { version, releaseDate: releaseDate ?? null };
  if (!parts.some((part) => part.heading?.level === 2 && groupOf(part.heading.children) !== null)) {
    return { ...base, intro: parts.flatMap(blocksOfPart), notes: [], plain: true };
  }

  const intro: MarkdownBlock[] = [];
  const notes: WhatsNewNote[] = [];
  let group: Group | null = null;
  for (const part of parts) {
    if (part.heading?.level === 2) {
      group = groupOf(part.heading.children) ?? { kind: 'other', heading: part.heading.children, generated: false };
      if (group.kind !== null) notes.push(...looseNotes(group.kind, group, part.blocks));
    } else if (!group) {
      intro.push(...blocksOfPart(part));
    } else if (group.kind !== null && part.heading) {
      notes.push({ kind: group.kind, title: part.heading.children, description: part.blocks });
    }
  }
  return { ...base, intro, notes, plain: false };
}

/**
 * A group of a release's notes. `kind` null leaves the group out (GitHub's "New Contributors"); `heading` names an
 * unknown group, whose text reads as one other change; `generated` is GitHub's own list of pull requests.
 */
interface Group {
  kind: NoteKind | null;
  heading?: MarkdownInline[];
  generated: boolean;
}

const GROUP_HEADINGS: Record<string, Group> = {
  new: { kind: 'new', generated: false },
  improved: { kind: 'improved', generated: false },
  fixed: { kind: 'fixed', generated: false },
  'other changes': { kind: 'other', generated: false },
  "what's changed": { kind: 'other', generated: true },
  'new contributors': { kind: null, generated: true },
};

function groupOf(heading: MarkdownInline[]): Group | null {
  return GROUP_HEADINGS[plainText(heading).trim().replace(/’/g, "'").toLowerCase()] ?? null;
}

/**
 * The notes a group writes without a level-3 heading: each item of a list is one (GitHub's generated notes, other
 * changes), and anything else between them reads as a note without a title. An unknown group is one note, titled
 * by its heading.
 */
function looseNotes(kind: NoteKind, group: Group, blocks: MarkdownBlock[]): WhatsNewNote[] {
  if (group.heading) return [{ kind, title: group.heading, description: blocks }];
  const notes: WhatsNewNote[] = [];
  for (const block of blocks) {
    if (block.kind === 'list') {
      for (const item of block.items) {
        const title = group.generated ? withoutAuthorTail(item.children) : item.children;
        notes.push({ kind, title, description: item.sublist ? [item.sublist] : [] });
      }
      continue;
    }
    const previous = notes.at(-1);
    if (previous && previous.title.length === 0) previous.description.push(block);
    else notes.push({ kind, title: [], description: [block] });
  }
  return notes;
}

/**
 * A pull request's title as GitHub's generated notes list it, without the "by @user in #12" they end with: who wrote
 * it and where are the repository's business, not the user's.
 */
export function withoutAuthorTail(inlines: MarkdownInline[]): MarkdownInline[] {
  if (inlines.length < 4) return inlines;
  const [by, author, inWord, pullRequest] = inlines.slice(-4) as [MarkdownInline, MarkdownInline, MarkdownInline, MarkdownInline];
  const isTail =
    by.kind === 'text' &&
    / by $/.test(by.text) &&
    isLinkNamed(author, /^@\S+$/) &&
    inWord.kind === 'text' &&
    inWord.text === ' in ' &&
    isLinkNamed(pullRequest, /^#\d+$/);
  if (!isTail) return inlines;
  const before = by.text.replace(/ by $/, '').trimEnd();
  return [...inlines.slice(0, -4), ...(before ? [{ kind: 'text', text: before } as const] : [])];
}

function isLinkNamed(inline: MarkdownInline, name: RegExp): boolean {
  return inline.kind === 'link' && name.test(plainText(inline.children));
}

function blocksOfPart({ heading, blocks }: ReleaseNotesPart): MarkdownBlock[] {
  return heading ? [{ kind: 'heading', level: heading.level, children: heading.children }, ...blocks] : blocks;
}

const FULL_CHANGELOG = /^full changelog\b/i;

/** Without the "**Full Changelog**: <link>" line GitHub ends its generated notes with, and the Release workflow keeps. */
function withoutChangelogLine(parts: ReleaseNotesPart[]): ReleaseNotesPart[] {
  const last = parts.at(-1);
  const line = last?.blocks.at(-1);
  if (!last || line?.kind !== 'paragraph' || !FULL_CHANGELOG.test(plainText(line.children))) return parts;
  const trimmed = { ...last, blocks: last.blocks.slice(0, -1) };
  return trimmed.heading || trimmed.blocks.length > 0 ? [...parts.slice(0, -1), trimmed] : parts.slice(0, -1);
}
