import type { Shelve } from '@shared/domain/shelve';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { matchesShelveFilter, myShelves, withFoundShelves, type MyShelve } from './myShelves';
import { SEARCH_LIMIT, SHOWN_LIMIT, shelvesListNote, type ShelvesScope } from './shelvesScope';

interface ShelvesListInput {
  scope: ShelvesScope;
  /** The scope's recent shelves, newest first. */
  listed: Shelve[];
  /** What the server search for the filter found (`shelvesSearchFilter`), once it answered. */
  found: Shelve[] | undefined;
  filter: string;
  /** This app's records of the shelves it left (`switchShelves`). */
  records: SwitchShelveRecord[];
  /** The user, to tell their shelves from others'. */
  me: string | undefined;
  now?: number;
}

export interface ShelvesListRows {
  /** The newest rows matching the filter, at most `SHOWN_LIMIT`. */
  shown: MyShelve[];
  /** The line under the list (`shelvesListNote`). */
  note: string | null;
}

/**
 * What the shelves list in Changes shows: the scope's shelves and, while filtering, the older ones the search found,
 * matched by the filter, the newest `SHOWN_LIMIT` of them, and the note that says what is left out.
 */
export function shelvesListRows({ scope, listed, found, filter, records, me, now }: ShelvesListInput): ShelvesListRows {
  const filtering = filter.trim() !== '';
  const shelves = filtering && found ? withFoundShelves(listed, found) : listed;
  const rows = myShelves(shelves, records, { everyone: scope === 'everyone', me }, now).filter((row) => matchesShelveFilter(row, filter));
  const shown = rows.slice(0, SHOWN_LIMIT);
  const searchFull = filtering && found?.length === SEARCH_LIMIT;
  return { shown, note: shelvesListNote({ shown: shown.length, total: rows.length, searchFull, filtering }) };
}
