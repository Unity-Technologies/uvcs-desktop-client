import { settlingChangeset, comparisonOf, contextMissingText, entryOfThread, type ContextComparison, type ContextEntry, type ContextView, type OnScreen, type ShownEntry } from './commentContext';
import type { LineThread } from './fileThreads';

/** What a view of "See in context" shows: its comparison, once the diff it needs is read, or why there's none yet. */
export type ContextComparisonState =
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'missing'; text: string }
  /** A change request marked applied in a changeset that didn't change its file: the thread shows, and this says why. */
  | { kind: 'notInChangeset'; changesetId: number; text: string }
  | { kind: 'comparison'; comparison: ContextComparison };

/** The diff read for a view (`useDiffEntries`'s answer), when its entry isn't the one on screen. */
export interface ReadDiff {
  data?: readonly ShownEntry[];
  error?: Error | null;
}

interface ComparisonInput {
  thread: LineThread;
  view: ContextView;
  repository: string;
  onScreen: OnScreen | null;
  /** Where the view finds the file's entry (`contextEntryOf`). */
  source: ContextEntry;
  read: ReadDiff;
  /** Where it finds what a file the applying changeset replaced was before the review (`replacedHistoryOf`). */
  replacedHistory?: { source: ContextEntry; read: ReadDiff };
}

/**
 * One view's comparison (`comparisonOf`), from the file's entry on screen or in the diff read for it: reading until that
 * diff is, its error if it fails, and what the view says when the file isn't in it (`contextMissingText`). "Since
 * then" compares even without an entry: the review deletes the file.
 */
export function contextComparisonState({ thread, view, repository, onScreen, source, read, replacedHistory = NO_HISTORY }: ComparisonInput): ContextComparisonState {
  if (source.kind === 'read' && read.error) return { kind: 'error', message: read.error.message };
  if (source.kind === 'read' && !read.data) return { kind: 'reading' };
  // A replaced file's history only turns its view into the move it made: a failed read compares it as any other file.
  const history = replacedHistory.read.error ? null : replacedHistory;
  if (history?.source.kind === 'read' && !history.read.data) return { kind: 'reading' };
  const entry = entryOf(source, onScreen, read, thread);
  const comparison = comparisonOf(thread, view, repository, entry, history && entryOf(history.source, onScreen, history.read, thread));
  if (comparison) return { kind: 'comparison', comparison };
  const appliedIn = settlingChangeset(thread);
  return view === 'since' && appliedIn !== undefined ? { kind: 'notInChangeset', changesetId: appliedIn, text: contextMissingText(thread, view) } : { kind: 'missing', text: contextMissingText(thread, view) };
}

const NO_HISTORY = { source: { kind: 'none' }, read: {} } as const;

/** The thread's file in the diff a view reads its entry from (`ContextEntry`): on screen, read, or none. */
export function entryOf(source: ContextEntry, onScreen: OnScreen | null, read: ReadDiff, thread: LineThread): ShownEntry | null {
  if (source.kind === 'onScreen') return onScreen?.entry ?? null;
  if (source.kind === 'read' && read.data) return entryOfThread(read.data, thread) ?? null;
  return null;
}
