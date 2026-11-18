import { createContext, useContext, type ReactNode } from 'react';
import { positionRanges, wordMatchRanges, type TextRange } from '../lib/textMatchRanges';
import styles from './Highlight.module.css';

const HighlightQueryContext = createContext('');

/** Sets the filter text that every `Highlight` inside highlights, so a list wraps once instead of passing it to each cell. */
export function HighlightQuery({ query, children }: { query: string; children: ReactNode }) {
  return <HighlightQueryContext.Provider value={query}>{children}</HighlightQueryContext.Provider>;
}

/** The filter text of the surrounding `HighlightQuery`, for labels that work out their own positions (a path cut to fit). */
export function useHighlightQuery(): string {
  return useContext(HighlightQueryContext);
}

interface HighlightProps {
  text: string;
  /** Exact character positions to highlight (e.g. of a fuzzy match); otherwise the words of the surrounding `HighlightQuery`. */
  positions?: readonly number[];
  /** Marks what a move changed in the diff's colors instead of a match (`PathMoveLines`). */
  tint?: MarkTint;
}

/** The diff's colors: what a move removed from a path, or added to it. */
export type MarkTint = 'removed' | 'added';

/** `text` with the parts matching the current filter marked, so users see why a row matched. */
export function Highlight({ text, positions, tint }: HighlightProps) {
  const query = useHighlightQuery();
  const ranges = positions ? positionRanges(positions) : wordMatchRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  return <>{renderRanges(text, ranges, tint)}</>;
}

function renderRanges(text: string, ranges: TextRange[], tint: MarkTint | undefined): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <HighlightMark key={start} tint={tint}>
        {text.slice(start, end)}
      </HighlightMark>,
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

/** Text the filter matched, marked as `Highlight` marks it: for text drawn in parts of its own (a colored command line). */
export function HighlightMark({ children, tint }: { children: ReactNode; tint?: MarkTint }) {
  return (
    <mark className={styles.match} data-tint={tint}>
      {children}
    </mark>
  );
}
