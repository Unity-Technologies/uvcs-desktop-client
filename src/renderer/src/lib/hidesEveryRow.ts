/**
 * Whether filters hide every row of a list that read some: it says "No matching …", and the pane beside it shows
 * nothing, as nothing can be selected. An empty read is a list with nothing in it, which says so its own way.
 */
export function hidesEveryRow(readCount: number, shownCount: number): boolean {
  return readCount > 0 && shownCount === 0;
}
