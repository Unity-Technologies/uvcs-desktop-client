import { comparisonOf, contextMissingText, entryOfThread, type ContextComparison, type ContextEntry, type ContextView, type OnScreen, type ShownEntry } from './commentContext';
import type { LineThread } from './fileThreads';

/** What a view of "See in context" shows: its comparison, once the diff it needs is read, or why there's none yet. */
export type ContextComparisonState =
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'missing'; text: string }
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
}

/**
 * One view's comparison (`comparisonOf`), from the file's entry on screen or in the diff read for it: reading until that
 * diff is, its error if it fails, and what the view says when the file isn't in it (`contextMissingText`). "Since
 * then" compares even without an entry: the review deletes the file.
 */
export function contextComparisonState({ thread, view, repository, onScreen, source, read }: ComparisonInput): ContextComparisonState {
  if (source.kind === 'read' && read.error) return { kind: 'error', message: read.error.message };
  if (source.kind === 'read' && !read.data) return { kind: 'reading' };
  const entry = entryOf(source, onScreen, read, thread);
  const comparison = comparisonOf(thread, view, repository, entry);
  return comparison ? { kind: 'comparison', comparison } : { kind: 'missing', text: contextMissingText(thread, view) };
}

function entryOf(source: ContextEntry, onScreen: OnScreen | null, read: ReadDiff, thread: LineThread): ShownEntry | null {
  if (source.kind === 'onScreen') return onScreen?.entry ?? null;
  if (source.kind === 'read' && read.data) return entryOfThread(read.data, thread) ?? null;
  return null;
}
