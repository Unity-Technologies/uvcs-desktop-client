import type { CodeReview } from '@shared/domain/codeReview';
import { useDiffEntries } from '../../diff/useDiffEntries';
import { contextEntryOf, replacedHistoryOf, type ContextView, type OnScreen } from './commentContext';
import { contextComparisonState, entryOf, type ContextComparisonState } from './contextComparisonState';
import type { LineThread } from './fileThreads';

interface ComparisonSource {
  review: CodeReview;
  thread: LineThread;
  view: ContextView;
  onScreen: OnScreen | null;
  repository: string;
}

/**
 * One view's comparison: from the file's entry on screen, or in a diff read for it (each the query the Changes tab
 * reads); for a file the applying changeset replaced, the review's whole diff too (`replacedHistoryOf`).
 */
export function useContextComparison({ review, thread, view, onScreen, repository }: ComparisonSource): ContextComparisonState {
  const source = contextEntryOf(review.target, thread, view, onScreen);
  const read = useDiffEntries(source.kind === 'read' ? source.target : null);
  const historySource = replacedHistoryOf(review.target, thread, view, onScreen, entryOf(source, onScreen, read, thread));
  const historyRead = useDiffEntries(historySource.kind === 'read' ? historySource.target : null);
  return contextComparisonState({ thread, view, repository, onScreen, source, read, replacedHistory: { source: historySource, read: historyRead } });
}
