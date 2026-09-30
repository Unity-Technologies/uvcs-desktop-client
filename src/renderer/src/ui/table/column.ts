import type { CSSProperties, ReactNode } from 'react';

/** A column of a `DataTable`: what its cells show, how wide it is, and what it sorts by. */
export interface Column<Row> {
  id: string;
  header: string;
  /** Fixed width in pixels; columns without one share the remaining space. */
  width?: number;
  /** Relative share of the remaining space for flexible columns (default 1). */
  grow?: number;
  align?: 'start' | 'end';
  secondary?: boolean;
  /** Hidden while the table is narrower than this, so the flexible columns (a comment, a name) keep room to be read. */
  hideBelow?: number;
  render: (row: Row) => ReactNode;
  sortValue?: (row: Row) => string | number;
}

/** The narrowest a flexible column gets, so its header and a few characters always show. */
const FLEXIBLE_MIN_WIDTH = 80;

/** A column's box in the header, the rows and the skeleton alike, so they line up. */
export function columnStyle<Row>(column: Column<Row>): CSSProperties {
  return column.width ? { width: column.width, flex: 'none' } : { flex: column.grow ?? 1, minWidth: FLEXIBLE_MIN_WIDTH };
}
