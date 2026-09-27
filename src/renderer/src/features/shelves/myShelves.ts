import { AUTOMATIC_SHELVE_COMMENT, type Shelve } from '@shared/domain/shelve';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { formatRelativeDate } from '../../lib/formatDate';
import { firstLine, pluralize } from '../../lib/text';

/** A shelve of the user's, as Changes lists it. */
export interface MyShelve {
  shelve: Shelve;
  title: string;
  /** e.g. "sh:12 · 2 hours ago · 3 changes": how many only when this app shelved them and counted. */
  detail: string;
  /** Changes a switch or an update left: restored and deleted at once, as "Welcome back" does. */
  left: boolean;
}

/**
 * The user's shelves (newest first, as listed) named for what they hold: the comment, or for changes a switch or an
 * update put aside, where they were left (this app's records know; another app's automatic shelves only say they were).
 */
export function myShelves(shelves: Shelve[], records: SwitchShelveRecord[], now = Date.now()): MyShelve[] {
  return shelves.map((shelve) => {
    const record = records.find((candidate) => candidate.shelveId === shelve.id && candidate.repository === shelve.repository);
    const leftByRecord = record !== undefined && record.reason !== 'shelve';
    const left = leftByRecord || shelve.comment.startsWith(AUTOMATIC_SHELVE_COMMENT);
    const count = record ? pluralize(record.paths.length, 'change') : null;
    return {
      shelve,
      title: leftByRecord ? leftTitle(record) : left ? 'Left when switching' : firstLine(shelve.comment) || '(no comment)',
      detail: [`sh:${shelve.id}`, formatRelativeDate(shelve.date, now), count].filter(Boolean).join(' · '),
      left,
    };
  });
}

function leftTitle(record: SwitchShelveRecord): string {
  return record.reason === 'update' ? `Put aside to update ${record.source.name}` : `Left on ${record.source.name}`;
}

/** Whether the shelve shows for the text typed: in its number, its comment or what it's called here, in any case. */
export function matchesShelveFilter({ shelve, title }: MyShelve, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  return `sh:${shelve.id} ${title} ${shelve.comment}`.toLowerCase().includes(needle);
}

/** The recent shelves and the older ones a search found, each once, newest first. */
export function withFoundShelves(recent: Shelve[], found: Shelve[]): Shelve[] {
  const listed = new Set(recent.map((shelve) => shelve.id));
  return [...recent, ...found.filter((shelve) => !listed.has(shelve.id))].sort((a, b) => b.id - a.id);
}

/** The chip's words: "3 shelves". */
export function myShelvesLabel(count: number): string {
  return pluralize(count, 'shelve');
}
