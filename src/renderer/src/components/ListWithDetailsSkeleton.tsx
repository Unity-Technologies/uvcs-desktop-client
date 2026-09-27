import { DetailsPanelSkeleton } from '../ui/DetailsPanel';
import type { Column } from '../ui/table/DataTable';
import { TableSkeleton } from '../ui/table/TableSkeleton';
import { ListWithDetails } from './ListWithDetails';

interface ListWithDetailsSkeletonProps<Row> {
  columns: Column<Row>[];
  rowHeight?: number;
  /** The view's details width, so the skeleton has the view's layout. */
  widthKey: string;
}

/** A list-and-details view while its rows load, laid out as it will be once they arrive. */
export function ListWithDetailsSkeleton<Row>({ columns, rowHeight, widthKey }: ListWithDetailsSkeletonProps<Row>) {
  return <ListWithDetails widthKey={widthKey} list={<TableSkeleton columns={columns} rowHeight={rowHeight} />} details={<DetailsPanelSkeleton />} />;
}
