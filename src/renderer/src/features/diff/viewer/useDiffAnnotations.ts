import type { FileDiff as FileDiffInstance } from '@pierre/diffs';
import { useCallback, useContext, useEffect, useRef, type RefObject } from 'react';
import type { ChangedLine } from './changeBlocks';
import { DiffAnnotationsContext, linesToReveal, rowsKey, type DiffAnnotations } from './diffAnnotations';
import type { HunkSides } from './lineToReveal';

type ScrollToLine = (element: HTMLElement, line: ChangedLine) => () => void;

interface DiffAnnotationsOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** The diff Pierre rendered, whose folded regions are unfolded for the rows' lines. */
  renderedDiff: RefObject<FileDiffInstance<unknown, unknown> | null>;
  hunks: readonly HunkSides[];
  /** The code is drawn (its language is ready): there is something to scroll. */
  shown: boolean;
  scrollTo: ScrollToLine;
}

/**
 * What the place around a text diff adds under its lines (`DiffAnnotationsContext`), for Pierre: its rows, unfolded
 * once rendered (`revealRows`, from the diff's post-render), and the line to scroll to, each time a new one is asked.
 */
export function useDiffAnnotations({ containerRef, renderedDiff, hunks, shown, scrollTo }: DiffAnnotationsOptions): {
  annotations: DiffAnnotations | null;
  revealRows: () => void;
} {
  const annotations = useContext(DiffAnnotationsContext);
  const latest = useRef({ rows: annotations?.rows ?? [], hunks });
  latest.current = { rows: annotations?.rows ?? [], hunks };
  // Once per set of rows: the user may fold a region again, and a later render must not undo that.
  const revealedFor = useRef<string | null>(null);
  const revealRows = useCallback(() => {
    const diff = renderedDiff.current;
    const { rows } = latest.current;
    const key = rowsKey(rows);
    if (!diff || rows.length === 0 || revealedFor.current === key) return;
    revealedFor.current = key;
    for (const line of linesToReveal(latest.current.hunks, rows)) diff.revealLine(line);
  }, [renderedDiff]);

  const latestScrollTo = useRef(scrollTo);
  latestScrollTo.current = scrollTo;
  const target = annotations?.scrollTo ?? null;
  useEffect(() => {
    const container = containerRef.current;
    if (!target || !container || !shown) return;
    revealRows();
    return latestScrollTo.current(container, target);
  }, [target, shown, containerRef, revealRows]);

  return { annotations, revealRows };
}
