import type { ReactNode } from 'react';
import { EmptyState } from '../ui/EmptyState';
import { HighlightQuery } from '../ui/Highlight';
import { DataTable } from '../ui/table/DataTable';
import { ListWithDetails } from './ListWithDetails';
import { ListWithDetailsSkeleton } from './ListWithDetailsSkeleton';
import { NoSelection } from './NoSelection';
import { objectListState } from './objectListState';

type TableProps<Row> = Parameters<typeof DataTable<Row>>[0];

interface ObjectListViewProps<Row> extends Omit<TableProps<Row>, 'selectFirstRow' | 'empty'> {
  /** Whose details width this is: each view remembers its own. */
  widthKey: string;
  /**
   * No rows have been read yet: a skeleton of the view's layout. TanStack's `isPending`, not `isLoading`: a query
   * still waiting to start (on the repository's name) has read nothing either, and must never read as empty.
   */
  loading: boolean;
  /** The rows couldn't be read. */
  error: Error | null;
  /** What says the rows couldn't be read: "Couldn't load labels". */
  errorTitle: string;
  /** Filters are on: an empty list means they hide every row read, not that there is none. */
  filtering: boolean;
  /** In the list, under its column titles, while the filters hide every row: `NoMatches`. */
  noMatches: ReactNode;
  /** In the details pane while there is no row at all: the view's first-use state. */
  emptyState: ReactNode;
  /** The filter text, marked in every cell that shows it. */
  query: string;
  /** The focused row's details, or undefined when no row is focused. */
  details: ReactNode | undefined;
  /** What a row is, for the details' empty state: "label". */
  noun: string;
}

/**
 * The body of every view listing objects (branches, changesets, labels, shelves, code reviews, locks, attributes),
 * under its header and filter bar: the table (a row always selected) with the focused row's details beside it
 * (ARCHITECTURE.md "List and details"). It keeps that layout from the first frame on: a skeleton of it while
 * loading; with no rows, the column titles over `noMatches` while filters hide them (nothing to select beside them),
 * else the empty state beside them.
 * Only an error reading the rows takes the whole body.
 */
export function ObjectListView<Row>({ widthKey, loading, error, errorTitle, filtering, noMatches, emptyState, query, details, noun, ...table }: ObjectListViewProps<Row>) {
  if (error) return <EmptyState title={errorTitle} description={error.message} />;
  const state = objectListState({ loading, rowCount: table.rows.length, filtering });
  if (state === 'loading') return <ListWithDetailsSkeleton widthKey={widthKey} columns={table.columns} />;
  return (
    <ListWithDetails
      widthKey={widthKey}
      list={
        <HighlightQuery query={query}>
          <DataTable {...table} selectFirstRow empty={state === 'noMatches' ? noMatches : undefined} />
        </HighlightQuery>
      }
      details={state === 'nothing' ? emptyState : state === 'noMatches' ? null : (details ?? <NoSelection noun={noun} />)}
    />
  );
}
