import { DetailsPanelSkeleton } from '../ui/DetailsPanelSkeleton';
import type { Column } from '../ui/table/column';
import { TableSkeleton } from '../ui/table/TableSkeleton';
import { ListWithDetails } from './ListWithDetails';

interface ListWithDetailsSkeletonProps<Row> {
  columns: Column<Row>[];
  rowHeight?: number;
  /** The view's details key, so the skeleton has the view's layout: its details' width, or none while they're hidden. */
  detailsKey: string;
}

/** A list-and-details view while its rows load, laid out as it will be once they arrive. */
export function ListWithDetailsSkeleton<Row>({ columns, rowHeight, detailsKey }: ListWithDetailsSkeletonProps<Row>) {
  return <ListWithDetails detailsKey={detailsKey} list={<TableSkeleton columns={columns} rowHeight={rowHeight} />} details={<DetailsPanelSkeleton />} />;
}
