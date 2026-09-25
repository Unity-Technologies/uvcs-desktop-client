import { DetailsPanelSkeleton } from '../ui/DetailsPanel';
import type { Column } from '../ui/table/DataTable';
import { TableSkeleton } from '../ui/table/TableSkeleton';
import { ListWithDetails } from './ListWithDetails';

/** A list-and-details view while its rows load, laid out as it will be once they arrive. */
export function ListWithDetailsSkeleton<Row>({ columns, rowHeight }: { columns: Column<Row>[]; rowHeight?: number }) {
  return <ListWithDetails list={<TableSkeleton columns={columns} rowHeight={rowHeight} />} details={<DetailsPanelSkeleton />} />;
}
