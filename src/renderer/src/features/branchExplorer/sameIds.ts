/** Whether two lists hold the same ids in the same order: the canvas's report of the branches near view changed or not. */
export function sameIds(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
