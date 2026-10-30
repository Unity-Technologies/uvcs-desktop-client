import type { MarkdownBlock } from '../../lib/markdown';
import { NOTE_KIND_LABELS, NOTE_KINDS, type NoteKind, type WhatsNewNote, type WhatsNewRelease } from './whatsNewRelease';

/** Which notes What's New shows: every one, or one kind. */
export type NotesFilter = 'all' | NoteKind;

export interface FilterChip {
  filter: NotesFilter;
  label: string;
  count: number;
}

/**
 * The chips that filter the notes, each with how many notes it shows across every release the update spans: All,
 * then each kind the notes hold. None when the notes hold fewer than two kinds, where a filter would show the same.
 */
export function filterChips(releases: readonly WhatsNewRelease[]): FilterChip[] {
  const notes = releases.flatMap((release) => release.notes);
  const kinds = NOTE_KINDS.map((kind) => ({ filter: kind, label: NOTE_KIND_LABELS[kind], count: notes.filter((note) => note.kind === kind).length }));
  const present = kinds.filter((chip) => chip.count > 0);
  return present.length < 2 ? [] : [{ filter: 'all', label: 'All', count: notes.length }, ...present];
}

export interface NoteGroup {
  kind: NoteKind;
  label: string;
  notes: WhatsNewNote[];
}

/** An older release's row, which names it and unfolds its notes. */
export interface ReleaseRow {
  version: string;
  /** How many notes it shows ("6 notes"), empty for notes written as plain Markdown. */
  count: string;
  /** Whether a click folds and unfolds it: under a filter every release shows its notes, so it only names them. */
  foldable: boolean;
}

export interface ReleaseSection {
  version: string;
  /** None for the update's own release, which the dialog's title names. */
  row: ReleaseRow | null;
  open: boolean;
  intro: MarkdownBlock[];
  groups: NoteGroup[];
}

/**
 * What the dialog's body shows: the update's own release open, under the title that names it, and each older one as a
 * row the user unfolds (`unfolded`, the versions they opened). A filter shows its kind of notes from every release at
 * once, so "Fixed" lists every fix since the running version; the releases with none of them are left out, and so is
 * what a release says outside its notes.
 */
export function releaseSections(releases: readonly WhatsNewRelease[], filter: NotesFilter, unfolded: ReadonlySet<string>): ReleaseSection[] {
  const newest = releases[0]?.version;
  return releases.flatMap((release) => {
    const notes = filter === 'all' ? release.notes : release.notes.filter((note) => note.kind === filter);
    if (filter !== 'all' && notes.length === 0) return [];
    const isNewest = release.version === newest;
    return [
      {
        version: release.version,
        row: isNewest ? null : { version: release.version, count: release.plain ? '' : noteCount(notes.length), foldable: filter === 'all' },
        open: isNewest || filter !== 'all' || unfolded.has(release.version),
        intro: filter === 'all' ? release.intro : [],
        groups: groupsOf(notes),
      },
    ];
  });
}

function groupsOf(notes: readonly WhatsNewNote[]): NoteGroup[] {
  return NOTE_KINDS.flatMap((kind) => {
    const ofKind = notes.filter((note) => note.kind === kind);
    return ofKind.length > 0 ? [{ kind, label: NOTE_KIND_LABELS[kind], notes: ofKind }] : [];
  });
}

function noteCount(count: number): string {
  return count === 1 ? '1 note' : `${count} notes`;
}

/** The versions unfolded after a click on `version`'s row. */
export function toggledRelease(unfolded: ReadonlySet<string>, version: string): Set<string> {
  const next = new Set(unfolded);
  if (!next.delete(version)) next.add(version);
  return next;
}

/**
 * The line under the dialog's title: the version running, then the day the update was released, when known.
 * `locale` is the user's (undefined) but for tests.
 */
export function whatsNewSubtitle(runningVersion: string | undefined, releaseDate: string | null, locale?: string): string[] {
  const released = releaseDate ? releasedOn(releaseDate, locale) : null;
  return [runningVersion ? `You have ${runningVersion}` : null, released].filter((part) => part !== null);
}

function releasedOn(isoDate: string, locale: string | undefined): string | null {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return `Released ${new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric' }).format(date)}`;
}
