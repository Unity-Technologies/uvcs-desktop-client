/** What a key pressed in Go to file's field does to its results: move the highlight, or pick the highlighted one. */
export type GoToFileKey = { kind: 'highlight'; index: number } | { kind: 'pick'; index: number };

/** The key's effect on `count` results with `highlighted` the highlighted one; none for any other key, or no result. */
export function goToFileKey(key: string, highlighted: number, count: number): GoToFileKey | null {
  if (count === 0) return null;
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    const step = key === 'ArrowDown' ? 1 : -1;
    return { kind: 'highlight', index: Math.min(count - 1, Math.max(0, highlighted + step)) };
  }
  if (key === 'Enter' && highlighted < count) return { kind: 'pick', index: highlighted };
  return null;
}
