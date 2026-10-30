import { formatDay, type DayFormat } from '../../lib/formatDate';
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

/** The color of a group's tag (`DetailsBadge`'s tones): new is green, improved blue, fixed amber, the rest grey. */
export type NoteGroupTone = 'success' | 'accent' | 'warning' | 'neutral';

const KIND_TONES: Record<NoteKind, NoteGroupTone> = { new: 'success', improved: 'accent', fixed: 'warning', other: 'neutral' };

export interface NoteGroup {
  kind: NoteKind;
  label: string;
  tone: NoteGroupTone;
  notes: WhatsNewNote[];
}

/** A release's row, which names it and unfolds its notes: every release but the update's own has one. */
export interface ReleaseRow {
  version: string;
  /** How many notes it shows ("6 notes"), empty for notes written as plain Markdown. */
  count: string;
  /** Whether a click folds and unfolds it: not under a filter, nor for the first release shown, which are always open. */
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

/** What the dialog's body shows: its releases, or a quiet line when none has anything to show. */
export type WhatsNewBody = { kind: 'empty' } | { kind: 'releases'; sections: ReleaseSection[] };

export function whatsNewBody(releases: readonly WhatsNewRelease[], filter: NotesFilter, unfolded: ReadonlySet<string>): WhatsNewBody {
  const sections = releaseSections(releases, filter, unfolded);
  return sections.length > 0 ? { kind: 'releases', sections } : { kind: 'empty' };
}

/**
 * Whether What's New has anything to show, so the update card and About offer it only then: GitHub's notes can hold
 * nothing but their "Full Changelog" line or their new contributors, both left out.
 */
export function hasWhatsNew(releases: readonly WhatsNewRelease[]): boolean {
  return releases.some(showsSomething);
}

function showsSomething(release: WhatsNewRelease): boolean {
  return release.notes.length > 0 || release.intro.length > 0;
}

/**
 * The releases the dialog shows: the update's own open, under the title that names it, and each older one as a row
 * the user unfolds (`unfolded`, the versions they opened). A release with nothing to show is left out; when that's
 * the update's own, the first release shown opens in its place. A filter shows its kind of notes from every release
 * at once, so "Fixed" lists every fix since the running version; the releases with none of them are left out, and so
 * is what a release says outside its notes.
 */
export function releaseSections(releases: readonly WhatsNewRelease[], filter: NotesFilter, unfolded: ReadonlySet<string>): ReleaseSection[] {
  const newest = releases[0]?.version;
  const shown = releases.flatMap((release) => {
    const notes = filter === 'all' ? release.notes : release.notes.filter((note) => note.kind === filter);
    const intro = filter === 'all' ? release.intro : [];
    return notes.length > 0 || intro.length > 0 ? [{ release, notes, intro }] : [];
  });
  return shown.map(({ release, notes, intro }, index) => {
    const alwaysOpen = filter !== 'all' || index === 0;
    return {
      version: release.version,
      row: release.version === newest ? null : { version: release.version, count: release.plain ? '' : noteCount(notes.length), foldable: !alwaysOpen },
      open: alwaysOpen || unfolded.has(release.version),
      intro,
      groups: groupsOf(notes),
    };
  });
}

function groupsOf(notes: readonly WhatsNewNote[]): NoteGroup[] {
  return NOTE_KINDS.flatMap((kind) => {
    const ofKind = notes.filter((note) => note.kind === kind);
    return ofKind.length > 0 ? [{ kind, label: NOTE_KIND_LABELS[kind], tone: KIND_TONES[kind], notes: ofKind }] : [];
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
 * The line under the dialog's title: the version running, then the day the update was released, when known, in the
 * user's locale and time zone unless `format` says otherwise (tests).
 */
export function whatsNewSubtitle(runningVersion: string | undefined, releaseDate: string | null, format?: DayFormat): string[] {
  const day = releaseDate ? formatDay(releaseDate, format) : null;
  return [runningVersion ? `You have ${runningVersion}` : null, day ? `Released ${day}` : null].filter((part) => part !== null);
}
