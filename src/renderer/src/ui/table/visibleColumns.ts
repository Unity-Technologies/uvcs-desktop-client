import type { Column } from './column';

/** The columns a table this wide shows: those hidden below a width give their room to the flexible ones. */
export function visibleColumns<Row>(columns: Column<Row>[], tableWidth: number): Column<Row>[] {
  return columns.filter((column) => !column.hideBelow || tableWidth >= column.hideBelow);
}
