import type { DiffLineAnnotation } from '@pierre/diffs';
import { createContext, type ReactNode } from 'react';
import type { ChangedLine } from './changeBlocks';
import { lineToReveal, type HunkSides } from './lineToReveal';

/**
 * What a place adds under a text diff's lines, given by it around the viewer (a review's comments in its Changes tab:
 * `ReviewFileAnnotator`). The viewer knows nothing of what they are:
 * - `rows`: Pierre's line annotations, each a row under its line drawn by `render` (`lineNumber: 0` is above the file's
 *   first line); the viewer unfolds the unchanged lines holding them, so none is hidden in a folded region;
 * - `markers`: a small mark at the end of a line whose row is folded away, a click opening it;
 * - `scrollTo`: the line whose row to bring into view, line and row whole and high in the view, once each time it's a
 *   new object (the thread a link or a list went to); `lineNumber: 0`, the rows above the code;
 * - `opensAtRow`: the place goes to one of its rows, now or once it knows where (a thread on a version still read), so
 *   the diff doesn't open at its first change, which would scroll past it.
 */
export interface DiffAnnotations {
  rows: DiffLineAnnotation<string>[];
  render: (row: DiffLineAnnotation<string>) => ReactNode;
  markers: LineMarker[];
  scrollTo: ChangedLine | null;
  opensAtRow: boolean;
}

/** A mark on a line, at the end of its pane. */
export interface LineMarker extends ChangedLine {
  key: string;
  /** What it marks, as a screen reader says it. */
  label: string;
  /** Its tooltip, when it says more than the label: a preview of what's folded there. */
  tip?: string;
  /** Drawn inside the mark: an icon, a count. */
  content: ReactNode;
  /** Draws it louder: something there still waits for an answer. */
  emphasized: boolean;
  onOpen: () => void;
}

/**
 * Marks the part of a row that's gone to (one thread of several under a line, one of the outdated ones above the code):
 * scrolling to the row shows that part whole (`scrollToAnnotationRow`). Without it, the whole row is.
 */
export const ROW_FOCUS_ATTRIBUTE = 'data-row-focus';

export const DiffAnnotationsContext = createContext<DiffAnnotations | null>(null);

/**
 * The newer side's lines to unfold (`FileDiff.revealLine`) so every row's line shows: with "Collapse unchanged lines"
 * a comment on an unchanged line far from any change would be folded away with it. Each once, in order; none for the
 * rows above the file (`lineNumber: 0`) or a removed line, which is never folded.
 */
export function linesToReveal(hunks: readonly HunkSides[], rows: readonly Pick<DiffLineAnnotation<string>, 'side' | 'lineNumber'>[]): number[] {
  const lines = new Set<number>();
  for (const row of rows) {
    if (row.lineNumber < 1) continue;
    const line = lineToReveal(hunks, row.side, row.lineNumber);
    if (line !== null) lines.add(line);
  }
  return [...lines].sort((a, b) => a - b);
}

/** What names a set of rows, to tell a new one from the same rows built anew. */
export function rowsKey(rows: readonly Pick<DiffLineAnnotation<string>, 'side' | 'lineNumber' | 'metadata'>[]): string {
  return rows.map((row) => `${row.side}:${row.lineNumber}:${row.metadata}`).join('|');
}

/** The room between a line's marker and the right edge of its pane. */
export const MARKER_INSET = 8;

/** Where a line's marker ends (its right edge, `LineMarkers`): over the end of the line, just inside its pane. */
export function markerLeft(paneRight: number): number {
  return paneRight - MARKER_INSET;
}
