import { EmptyState } from '../../../ui/EmptyState';
import { CenteredSpinner } from '../../../ui/Spinner';
import type { ContextComparisonState } from './contextComparisonState';

/** What a view of "See in context" shows until it has its comparison: reading, the read's error, or why there's none. */
export function ContextViewPending({ state }: { state: Exclude<ContextComparisonState, { kind: 'comparison' }> }) {
  switch (state.kind) {
    case 'reading':
      return <CenteredSpinner />;
    case 'error':
      return <EmptyState title="Couldn't load this diff" description={state.message} />;
    case 'missing':
    // The dialog shows the thread with it (`ThreadDialog`); a list of the changeset's files never needs it.
    case 'notInChangeset':
      return <EmptyState title={state.text} />;
  }
}
