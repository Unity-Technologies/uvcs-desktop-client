import type { Changeset } from '@shared/domain/changeset';
import type { QueryFilter } from '@shared/domain/query';
import { displayName } from '../../lib/userName';

export type DatePreset = 'week' | 'twoWeeks' | 'month' | 'quarter' | 'year' | 'all';

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  week: 'Last week',
  twoWeeks: 'Last 15 days',
  month: 'Last month',
  quarter: 'Last 3 months',
  year: 'Last year',
  all: 'Any time',
};

const DAYS_BACK: Record<Exclude<DatePreset, 'all'>, number> = { week: 7, twoWeeks: 15, month: 30, quarter: 90, year: 365 };

/** Keeps "Any time" usable on huge repositories. */
const ANY_TIME_LIMIT = 2000;

export interface ChangesetFilterState {
  search: string;
  datePreset: DatePreset;
  onlyMine: boolean;
  onlyCurrentBranch: boolean;
}

export const DEFAULT_CHANGESET_FILTER: ChangesetFilterState = {
  search: '',
  datePreset: 'month',
  onlyMine: false,
  onlyCurrentBranch: false,
};

/** What to ask `cm find` for. The text search is applied locally, so typing stays instant. */
export function toQueryFilter(state: Omit<ChangesetFilterState, 'search'>, currentBranch: string | undefined, today: Date): QueryFilter {
  return {
    sinceDate: state.datePreset === 'all' ? undefined : isoDateDaysBefore(today, DAYS_BACK[state.datePreset]),
    owner: state.onlyMine ? 'me' : undefined,
    branch: state.onlyCurrentBranch ? currentBranch : undefined,
    limit: state.datePreset === 'all' ? ANY_TIME_LIMIT : undefined,
  };
}

/** Whether the changeset's number, comment, author (as stored or as shown) or branch contains the search. */
export function matchesSearch(changeset: Changeset, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [String(changeset.id), changeset.comment, changeset.owner, displayName(changeset.owner), changeset.branch].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

/** What to try when nothing shows: the search only looks through what the other filters read. */
export function noChangesetsHint({ search, datePreset }: ChangesetFilterState): string {
  const searching = search.trim() !== '';
  if (datePreset !== 'all') return searching ? 'The search looks within the time range. Try a longer one.' : 'Try a longer time range.';
  return searching ? `Any time reads the newest ${ANY_TIME_LIMIT.toLocaleString('en-US')} changesets.` : 'Try fewer filters.';
}

/** The header's count; "Any time" says when it stopped at its cap, so a missing old changeset isn't a surprise. */
export function changesetsCount(shown: number, read: number, datePreset: DatePreset): string {
  return datePreset === 'all' && read >= ANY_TIME_LIMIT ? `${shown} shown of the newest ${ANY_TIME_LIMIT.toLocaleString('en-US')}` : `${shown} shown`;
}

function isoDateDaysBefore(today: Date, days: number): string {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
