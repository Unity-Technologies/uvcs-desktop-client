/** A `[start, end)` slice of a text to highlight. */
export type TextRange = readonly [start: number, end: number];

/** Every case-insensitive occurrence of each word of `query` in `text`, sorted and merged. For substring filters. */
export function wordMatchRanges(text: string, query: string): TextRange[] {
  const haystack = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const word of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    for (let found = haystack.indexOf(word); found !== -1; found = haystack.indexOf(word, found + word.length)) {
      ranges.push([found, found + word.length]);
    }
  }
  return mergeRanges(ranges);
}

/** Single character positions (e.g. of a fuzzy match) as ranges, joining neighbours. */
export function positionRanges(positions: readonly number[]): TextRange[] {
  return mergeRanges(positions.map((position) => [position, position + 1]));
}

function mergeRanges(ranges: [number, number][]): TextRange[] {
  const merged: [number, number][] = [];
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
