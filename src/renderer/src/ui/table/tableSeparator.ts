/**
 * A `DataTable`'s separator: a line with words between two rows that is no row (`DataTableProps.separator`). The
 * selection and the keys go by the rows alone; the virtual list holds one place more, the separator's, and the rows
 * from it on sit one place further down. Places and rows are both counted from 0; -1 is "no separator".
 */

/** The index of the row the separator goes before, or -1: none asked for, or that row isn't shown (a filter hides it). */
export function separatorIndexOf(orderedKeys: readonly string[], beforeKey: string | undefined): number {
  return beforeKey === undefined ? -1 : orderedKeys.indexOf(beforeKey);
}

/** Where a row sits in the virtual list. */
export function placeOfRow(rowIndex: number, separatorIndex: number): number {
  return separatorIndex !== -1 && rowIndex >= separatorIndex ? rowIndex + 1 : rowIndex;
}

/** The row at a place of the virtual list; null for the separator's. */
export function rowAtPlace(place: number, separatorIndex: number): number | null {
  if (separatorIndex === -1 || place < separatorIndex) return place;
  return place === separatorIndex ? null : place - 1;
}
