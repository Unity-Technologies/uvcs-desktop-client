import type { ReactNode } from 'react';
import { EmptyState } from '../ui/EmptyState';
import { HighlightQuery } from '../ui/Highlight';
import { DataTable } from '../ui/table/DataTable';
import { ListWithDetails } from './ListWithDetails';
import { ListWithDetailsSkeleton } from './ListWithDetailsSkeleton';
import { NoSelection } from './NoSelection';

type TableProps<Row> = Parameters<typeof DataTable<Row>>[0];

interface ObjectListViewProps<Row> extends Omit<TableProps<Row>, 'selectFirstRow'> {
  /** Whose details width this is: each view remembers its own. */
  widthKey: string;
  /** The rows are being read for the first time: a skeleton of the view's layout. */
  loading: boolean;
  /** The rows couldn't be read. */
  error: Error | null;
  /** What says the rows couldn't be read: "Couldn't load labels". */
  errorTitle: string;
  /** What shows when no row does: `NoMatches` while filters hide every row read, else the view's first-use state. */
  empty: ReactNode;
  /** The filter text, marked in every cell that shows it. */
  query: string;
  /** The focused row's details, or undefined when no row is focused. */
  details: ReactNode | undefined;
  /** What a row is, for the details' empty state: "label". */
  noun: string;
}

/**
 * The body of every view listing objects (branches, changesets, labels, shelves, code reviews, locks, attributes),
 * under its header and filter bar: a skeleton while loading, the error, the empty state, or the table (a row always
 * selected) with the focused row's details beside it (ARCHITECTURE.md "List and details").
 */
export function ObjectListView<Row>({ widthKey, loading, error, errorTitle, empty, query, details, noun, ...table }: ObjectListViewProps<Row>) {
  if (loading) return <ListWithDetailsSkeleton widthKey={widthKey} columns={table.columns} />;
  if (error) return <EmptyState title={errorTitle} description={error.message} />;
  if (table.rows.length === 0) return empty;
  return (
    <ListWithDetails
      widthKey={widthKey}
      list={
        <HighlightQuery query={query}>
          <DataTable {...table} selectFirstRow />
        </HighlightQuery>
      }
      details={details ?? <NoSelection noun={noun} />}
    />
  );
}
