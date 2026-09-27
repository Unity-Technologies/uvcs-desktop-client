import type { QueryFilter } from '@shared/domain/query';
import { sinceDateFor, sincePresetLabel, type SincePreset } from '../../lib/sincePresets';
import { formatCount } from '../../lib/text';

/** Whose shelves the list in Changes shows: the user's (always first) or everyone's in the repository. */
export type ShelvesScope = 'mine' | 'everyone';

/** How far back the list goes, for either scope; searching finds older ones. */
export const SHELVES_SINCE: SincePreset = 'last3Months';
/**
 * How far back a search of everyone's shelves goes. `cm` can't sort shelves, and `limit` keeps the oldest matches, so
 * a date bounds it instead: on codice@cloud (3,700 shelves) a year holds 78 matches of the loosest search.
 */
const EVERYONE_SEARCH_SINCE: SincePreset = 'lastYear';
/** A ceiling on what a search brings, room for the loose matches of `caseTolerantPattern` (filtered precisely after). */
export const SEARCH_LIMIT = 100;
/** Rows the list renders; the rest are reached by filtering. */
export const SHOWN_LIMIT = 200;

/** `like` patterns drop each word's first letter: two letters would match nearly everything. */
const MIN_SEARCH_LENGTH = 3;
const SHELVE_NUMBER = /^(?:sh:)?\d+$/i;

/** The one `cm find shelve` the list reads: by owner and date for the user's, by date alone for everyone's. */
export function shelvesListFilter(scope: ShelvesScope, now = new Date()): QueryFilter {
  const sinceDate = sinceDateFor(SHELVES_SINCE, now);
  return scope === 'mine' ? { owner: 'me', sinceDate } : { sinceDate };
}

/**
 * The server search for what was typed, finding shelves older than the list's (by comment: `cm` matches owners only
 * whole, so authors are matched in the list), or null when there's nothing worth asking: too short, or a number,
 * which only matches what is listed.
 */
export function shelvesSearchFilter(scope: ShelvesScope, text: string, now = new Date()): QueryFilter | null {
  const term = text.trim();
  if (term.length < MIN_SEARCH_LENGTH || SHELVE_NUMBER.test(term)) return null;
  return scope === 'mine'
    ? { owner: 'me', text: term, limit: SEARCH_LIMIT }
    : { text: term, sinceDate: sinceDateFor(EVERYONE_SEARCH_SINCE, now), limit: SEARCH_LIMIT };
}

/** The filter's placeholder: what it matches. */
export function shelvesFilterPlaceholder(scope: ShelvesScope): string {
  return scope === 'mine' ? 'Filter your shelves' : 'Filter by comment or author';
}

/** Why the list is empty. */
export function shelvesEmptyMessage(scope: ShelvesScope, filtering: boolean): string {
  const since = sincePresetLabel(SHELVES_SINCE).toLowerCase();
  if (scope === 'mine') return filtering ? 'None of your shelves match.' : `No shelves from the ${since}.`;
  return filtering ? 'No shelves match.' : `No shelves from anyone in the ${since}.`;
}

/**
 * The line under the list, when it doesn't show everything: more rows than it renders, or a search that brought as many
 * as it may (older matches may be missing); otherwise how far back it goes. Null for an empty list.
 */
export function shelvesListNote({ shown, total, searchFull, filtering }: { shown: number; total: number; searchFull: boolean; filtering: boolean }): string | null {
  if (total === 0) return null;
  if (total > shown) return `Newest ${formatCount(shown)} of ${formatCount(total)} · filter to find others`;
  if (searchFull) return 'More may match · type more to narrow';
  return filtering ? null : `${sincePresetLabel(SHELVES_SINCE)} · search finds older ones`;
}
