import { navigationTarget } from '../../lib/listNavigation';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import type { MemberRow } from './members';

/** Past this many entries the list gets a filter. */
const FILTER_FROM = 8;

/** What the permissions dialog's list of users and groups shows for its rows, selection and filter. */
export interface MemberListView {
  /** The list is long enough to show its filter field. */
  filters: boolean;
  /**
   * The filter that applies: none once the list is too short to show its field (removing a member can make it so),
   * which would otherwise hide rows with no field left to clear it.
   */
  query: string;
  /** The rows the filter keeps, in the rows' order. */
  shown: MemberRow[];
  /** The selected row, which the remove button and shortcut act on; none while the filter hides it. */
  selectedRow: MemberRow | undefined;
  /** Where the selected row is among `shown`; -1 when it isn't there. */
  selectedIndex: number;
}

export function memberListView(rows: readonly MemberRow[], selected: string | undefined, filter: string): MemberListView {
  const filters = rows.length > FILTER_FROM;
  const query = filters ? filter : '';
  const shown = rows.filter((row) => matchesWordFilter([row.label], query));
  return {
    filters,
    query,
    shown,
    selectedRow: shown.find((row) => row.member.name === selected),
    selectedIndex: shown.findIndex((row) => row.member.name === selected),
  };
}

/**
 * The member a navigation key selects next, by name; undefined when the key doesn't navigate the list. With no row
 * selected among those shown, ↓ and ↑ land on the first.
 */
export function memberAfterKey(view: MemberListView, key: string): string | undefined {
  const next = navigationTarget(key, view.selectedIndex, view.shown.length);
  return next === null ? undefined : view.shown[next]!.member.name;
}
