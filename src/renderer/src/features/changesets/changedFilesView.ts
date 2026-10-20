import { pluralize } from '../../lib/text';

/** Short lists read at a glance; longer ones get the path and status filter. */
const FILTER_FROM = 8;

interface ChangedFilesInput {
  /** How many files the diff lists (`listedEntries`); undefined until they are read. */
  listedCount: number | undefined;
  /** How many of them the filter keeps. */
  matchingCount: number;
  /** The user asked for the files here. */
  requested: boolean;
  /** Reading them failed. */
  failed: boolean;
  /** The user hid the list (every details panel keeps it so). */
  collapsed: boolean;
}

/** What the changes pane of a details panel shows, from the files read and what the user asked. */
export interface ChangedFilesView {
  title: string;
  /** "Show changed files": nothing is read until asked, as `cm diff` is heavy. */
  offersToShow: boolean;
  loading: boolean;
  /** The files are read and shown, and there are none. */
  noChanges: boolean;
  filters: boolean;
  /** The filter hides every file. */
  noMatches: boolean;
  listsFiles: boolean;
  /** The layout menu (list or tree) shows in the title while there's a list and no filter bar to hold it. */
  layoutMenu: boolean;
  /** The pane takes the room its list needs. */
  expanded: boolean;
  /** The title can hide and show the list once it is read. */
  collapsible: boolean;
}

export function changedFilesView({ listedCount, matchingCount, requested, failed, collapsed }: ChangedFilesInput): ChangedFilesView {
  const read = listedCount !== undefined;
  const shownCount = read && !collapsed ? listedCount : undefined;
  const listsFiles = shownCount !== undefined && shownCount > 0;
  const filters = shownCount !== undefined && shownCount > FILTER_FROM;
  return {
    title: read ? `${pluralize(listedCount, 'file')} changed` : 'Changes',
    offersToShow: !read && !requested,
    loading: !read && requested && !failed,
    noChanges: shownCount === 0,
    filters,
    noMatches: listsFiles && matchingCount === 0,
    listsFiles,
    layoutMenu: listsFiles && !filters,
    expanded: listsFiles,
    collapsible: read,
  };
}
