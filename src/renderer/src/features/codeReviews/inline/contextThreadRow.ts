import type { DiffLineAnnotation } from '@pierre/diffs';
import type { LineBand } from '../../diff/viewer/diffAnnotations';
import type { ThreadSide } from './fileThreads';
import { lineKey } from './threadRows';

/** The row See in context gives its diff, under the thread's line; its marker, while hidden, has the same name. */
export const THREAD_ROW = 'thread';

/** What See in context's diff shows of its one thread (`useThreadRow`). */
export interface ContextThreadParts {
  /** The thread's card under its line, while it shows. */
  rows: DiffLineAnnotation<string>[];
  /** Hidden: a marker on its line stands for it, a click showing it again. */
  marked: boolean;
  /** Its line, outlined in the accent: the thread is what the dialog is about, selected from the start. */
  bands: LineBand[];
}

/**
 * The thread under its line, or, hidden from the code (the header's comments button, to read the code alone), a marker
 * on its line, as the review's diff hides its comments; its line outlined either way.
 */
export function contextThreadParts(side: ThreadSide, line: number, shown: boolean): ContextThreadParts {
  return {
    rows: shown ? [{ side, lineNumber: line, metadata: THREAD_ROW }] : [],
    marked: !shown,
    bands: [{ key: lineKey(side, line), side, lineNumber: line, selected: true }],
  };
}
