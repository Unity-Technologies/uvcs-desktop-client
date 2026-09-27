import { AUTOMATIC_SHELVE_COMMENT, type Shelve } from '@shared/domain/shelve';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { formatRelativeDate } from '../../lib/formatDate';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { firstLine, pluralize } from '../../lib/text';
import { displayName } from '../../lib/userName';

/** A shelve as Changes lists it. */
export interface MyShelve {
  shelve: Shelve;
  title: string;
  /** "sh:12", first on the line under the title. */
  spec: string;
  /** What follows it, e.g. "2 hours ago · 3 changes": how many only when this app shelved them and counted. */
  detail: string;
  /** Who shelved it, where the list shows everyone's: "You", or their name. */
  author: string | null;
  /** The user's own: only those can be deleted from here, or restored. */
  mine: boolean;
  /** Changes a switch or an update left: restored and deleted at once, as "Welcome back" does. */
  left: boolean;
}

interface ShelveRowsOptions {
  /** Whether the shelves are everyone's, named by author; otherwise they are all the user's. */
  everyone: boolean;
  /** The user, to tell their shelves from others' (unknown while it's read: none are). */
  me: string | undefined;
}

/**
 * The shelves (newest first, as listed) named for what they hold: the comment, or for changes a switch or an update
 * put aside, where they were left (this app's records know; another app's automatic shelves only say they were).
 * Someone else's automatic shelve applies like any other: it's theirs to restore.
 */
export function myShelves(shelves: Shelve[], records: SwitchShelveRecord[], { everyone, me }: ShelveRowsOptions, now = Date.now()): MyShelve[] {
  return shelves.map((shelve) => {
    const mine = !everyone || (me !== undefined && sameUser(shelve.owner, me));
    const record = mine ? records.find((candidate) => candidate.shelveId === shelve.id && candidate.repository === shelve.repository) : undefined;
    const leftByRecord = record !== undefined && record.reason !== 'shelve';
    const automatic = shelve.comment.startsWith(AUTOMATIC_SHELVE_COMMENT);
    const left = mine && (leftByRecord || automatic);
    const count = record ? pluralize(record.paths.length, 'change') : null;
    return {
      shelve,
      title: leftByRecord ? leftTitle(record) : automatic ? 'Left when switching' : firstLine(shelve.comment) || '(no comment)',
      spec: `sh:${shelve.id}`,
      detail: [formatRelativeDate(shelve.date, now), count].filter(Boolean).join(' · '),
      author: everyone ? (mine ? 'You' : displayName(shelve.owner)) : null,
      mine,
      left,
    };
  });
}

function sameUser(owner: string, me: string): boolean {
  return owner.toLowerCase() === me.toLowerCase();
}

function leftTitle(record: SwitchShelveRecord): string {
  return record.reason === 'update' ? `Put aside to update ${record.source.name}` : `Left on ${record.source.name}`;
}

/** Whether the shelve shows for the words typed: each in its number, its comment, what it's called here or its author, in any case. */
export function matchesShelveFilter({ shelve, title, spec, author }: MyShelve, filter: string): boolean {
  return matchesWordFilter([spec, title, shelve.comment, ...(author === null ? [] : [author, shelve.owner])], filter);
}

/** The recent shelves and the older ones a search found, each once, newest first. */
export function withFoundShelves(recent: Shelve[], found: Shelve[]): Shelve[] {
  const listed = new Set(recent.map((shelve) => shelve.id));
  return [...recent, ...found.filter((shelve) => !listed.has(shelve.id))].sort((a, b) => b.id - a.id);
}

/** The button's words: "3 shelves", or just "Shelves" while it shows with none of the user's (open on everyone's). */
export function myShelvesLabel(count: number): string {
  return count === 0 ? 'Shelves' : pluralize(count, 'shelve');
}
