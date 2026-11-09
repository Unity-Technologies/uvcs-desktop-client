import type { DiffLineAnnotation, FileDiff as FileDiffInstance } from '@pierre/diffs';
import { useCallback, useContext, useEffect, useRef, type RefObject } from 'react';
import type { ChangedLine } from './changeBlocks';
import { DiffAnnotationsContext, linesToReveal, rowsKey, type DiffAnnotations, type LineMarker } from './diffAnnotations';
import type { HunkSides } from './lineToReveal';

/** A marker as the row it stands for, to unfold its line. */
function markedRow(marker: LineMarker): DiffLineAnnotation<string> {
  return { side: marker.side, lineNumber: marker.lineNumber, metadata: marker.key };
}

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
 * What the place around a text diff adds under its lines (`DiffAnnotationsContext`), for Pierre: its rows and its
 * markers' lines, unfolded once rendered (`revealRows`, from the diff's post-render), and the line to scroll to, each
 * time a new one is asked.
 */
export function useDiffAnnotations({ containerRef, renderedDiff, hunks, shown, scrollTo }: DiffAnnotationsOptions): {
  annotations: DiffAnnotations | null;
  revealRows: () => void;
} {
  const annotations = useContext(DiffAnnotationsContext);
  // A marker's line is unfolded as a row's is: what's marked would hide in a folded region otherwise.
  const marked = [...(annotations?.rows ?? []), ...(annotations?.markers ?? []).map(markedRow)];
  const latest = useRef({ rows: marked, hunks });
  latest.current = { rows: marked, hunks };
  // At every render: Pierre lays the diff out anew at times (the highlighted text replacing the plain one), folding its
  // regions again. A line already shown unfolds nothing (`revealLine` answers false), so the render this causes ends it.
  const revealRows = useCallback(() => {
    const diff = renderedDiff.current;
    const { rows } = latest.current;
    if (!diff) return;
    for (const line of linesToReveal(latest.current.hunks, rows)) diff.revealLine(line);
  }, [renderedDiff]);

  // Lines marked later (a thread placed once its version is read) change no rows Pierre renders: unfold them now.
  const markedKey = rowsKey(marked);
  useEffect(() => revealRows(), [markedKey, revealRows]);

  const latestScrollTo = useRef(scrollTo);
  latestScrollTo.current = scrollTo;
  const target = annotations?.scrollTo ?? null;
  useEffect(() => {
    const container = containerRef.current;
    if (!target || !container || !shown) return;
    revealRows();
    // A row above the code (`lineNumber: 0`) shows at the top of the diff.
    if (target.lineNumber < 1) return void container.scrollTo({ top: 0 });
    return latestScrollTo.current(container, target);
  }, [target, shown, containerRef, revealRows]);

  return { annotations, revealRows };
}
