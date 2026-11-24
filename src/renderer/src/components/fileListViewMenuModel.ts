import type { FileListFacts } from './fileListOrder';
import type { FileListLayout, FileListSort, FileListView } from './fileListViewStore';

/** What a list offers in its view menu beyond what every list has (layout, sort). */
export interface FileListViewOffer {
  /** Changes' grouping by changelist, on or off; undefined in every other list. */
  changelists?: boolean;
  /** Whether its files can go in a group per status (`GroupedFileListFacts.statusGroup`). */
  statusGroups: boolean;
  /** Whether its files have dates to sort by: read from the list's facts (`viewOfferFor`), never written out. */
  dates: boolean;
}

/**
 * The offer of a list whose files `facts` describes: a sort by date where they have dates (`FileListFacts.dateOf`), so
 * the menu offers it exactly where `fileListOrder` can sort by it.
 */
export function viewOfferFor(facts: Pick<FileListFacts<never>, 'dateOf'>, offer: Omit<FileListViewOffer, 'dates'>): FileListViewOffer {
  return { ...offer, dates: facts.dateOf !== undefined };
}

export type FileListGrouping = 'changelist' | 'status';

export interface ViewMenuChoice<T extends string> {
  value: T;
  label: string;
}

/** The view menu of a list of files (`FileListViewMenu`): what it offers, what is chosen, what its button says. */
export interface FileListViewMenuModel {
  layouts: ViewMenuChoice<FileListLayout>[];
  layout: FileListLayout;
  /** The groupings the list offers, each on or off; empty hides the section. */
  groupings: (ViewMenuChoice<FileListGrouping> & { on: boolean })[];
  sorts: ViewMenuChoice<FileListSort>[];
  sort: FileListSort;
  /** The button's tooltip and name: the view as it is ("View options: Tree, grouped by changelist and status, sorted by name"). */
  summary: string;
}

const LAYOUTS: ViewMenuChoice<FileListLayout>[] = [
  { value: 'list', label: 'List' },
  { value: 'tree', label: 'Tree' },
];

export const SORTS: ViewMenuChoice<FileListSort>[] = [
  { value: 'path', label: 'Path' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
  { value: 'extension', label: 'Extension' },
  { value: 'date', label: 'Date' },
];

const SORT_WORDS: Record<FileListSort, string> = { path: 'by path', name: 'by name', status: 'by status', extension: 'by extension', date: 'by date' };

/**
 * The menu for `view` in a list offering `offer`. A list without dates offers no sort by date, and shows its files by
 * path while it is the sort chosen, as `fileListOrder` orders them.
 */
export function fileListViewMenu(view: FileListView, offer: FileListViewOffer): FileListViewMenuModel {
  const groupings: FileListViewMenuModel['groupings'] = [];
  if (offer.changelists !== undefined) groupings.push({ value: 'changelist', label: 'Changelist', on: offer.changelists });
  if (offer.statusGroups) groupings.push({ value: 'status', label: 'Status', on: view.groupByStatus });
  const sorts = offer.dates ? SORTS : SORTS.filter((sort) => sort.value !== 'date');
  const sort = sorts.some((offered) => offered.value === view.sort) ? view.sort : 'path';
  return { layouts: LAYOUTS, layout: view.layout, groupings, sorts, sort, summary: viewSummary(view.layout, groupings, sort) };
}

/** "Tree", "List, grouped by changelist and status", "Tree, sorted by name": what isn't the default is named. */
function viewSummary(layout: FileListLayout, groupings: FileListViewMenuModel['groupings'], sort: FileListSort): string {
  const parts = [layout === 'tree' ? 'Tree' : 'List'];
  const grouped = groupings.filter((grouping) => grouping.on).map((grouping) => grouping.label.toLowerCase());
  if (grouped.length > 0) parts.push(`grouped by ${grouped.join(' and ')}`);
  if (sort !== 'path') parts.push(`sorted ${SORT_WORDS[sort]}`);
  return `View options: ${parts.join(', ')}`;
}
