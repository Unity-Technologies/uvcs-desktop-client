/**
 * Binary searches over ascending numbers (times, ids). One object, so a scale test counts the searches a computation
 * makes (`countCalls`) rather than timing it.
 */
export const sortedSearch = {
  /** The index of the first value at or after `value`; the length when there is none. */
  lowerBound(values: ArrayLike<number>, value: number): number {
    let low = 0;
    let high = values.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (values[middle]! < value) low = middle + 1;
      else high = middle;
    }
    return low;
  },

  /** The index of the first value after `value`; the length when there is none. */
  upperBound(values: ArrayLike<number>, value: number): number {
    let low = 0;
    let high = values.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (values[middle]! <= value) low = middle + 1;
      else high = middle;
    }
    return low;
  },
};

/** How many of the ascending `values` lie in [from, to]. */
export function countBetween(values: ArrayLike<number>, from: number, to: number): number {
  return to < from ? 0 : sortedSearch.upperBound(values, to) - sortedSearch.lowerBound(values, from);
}

/** The values ascending, as a typed array: the form every search here takes. */
export function ascending(values: readonly number[]): Float64Array {
  return Float64Array.from(values).sort();
}
