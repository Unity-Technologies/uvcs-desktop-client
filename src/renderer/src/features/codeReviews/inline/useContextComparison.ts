import type { CodeReview } from '@shared/domain/codeReview';
import { useDiffEntries } from '../../diff/useDiffEntries';
import { comparisonOf, contextEntryOf, contextMissingText, entryOfThread, type ContextComparison, type ContextView, type OnScreen } from './commentContext';
import type { LineThread } from './fileThreads';

/** What a view of "See in context" compares, once the diff it needs is read (`contextEntryOf`, `comparisonOf`). */
export type ContextComparisonState =
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'missing'; text: string }
  | { kind: 'comparison'; comparison: ContextComparison };

interface ComparisonSource {
  review: CodeReview;
  thread: LineThread;
  view: ContextView;
  onScreen: OnScreen | null;
  repository: string;
}

/** One view's comparison: from the file's entry on screen, or in a diff read for it (each the query the Changes tab reads). */
export function useContextComparison({ review, thread, view, onScreen, repository }: ComparisonSource): ContextComparisonState {
  const source = contextEntryOf(review.target, thread, view, onScreen);
  const read = useDiffEntries(source.kind === 'read' ? source.target : null);
  if (source.kind === 'read' && read.error) return { kind: 'error', message: read.error.message };
  if (source.kind === 'read' && !read.data) return { kind: 'reading' };
  const entry = source.kind === 'onScreen' ? (onScreen?.entry ?? null) : source.kind === 'read' && read.data ? (entryOfThread(read.data, thread) ?? null) : null;
  const comparison = comparisonOf(thread, view, repository, entry);
  return comparison ? { kind: 'comparison', comparison } : { kind: 'missing', text: contextMissingText(thread, view) };
}
