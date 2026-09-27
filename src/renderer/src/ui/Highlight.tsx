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
}

/** `text` with the parts matching the current filter marked, so users see why a row matched. */
export function Highlight({ text, positions }: HighlightProps) {
  const query = useHighlightQuery();
  const ranges = positions ? positionRanges(positions) : wordMatchRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  return <>{renderRanges(text, ranges)}</>;
}

function renderRanges(text: string, ranges: TextRange[]): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className={styles.match}>
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}
