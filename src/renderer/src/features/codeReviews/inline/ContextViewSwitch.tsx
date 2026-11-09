import { SegmentedControl } from '../../../ui/SegmentedControl';
import { contextViewLabels, type ContextView } from './commentContext';
import type { LineThread } from './fileThreads';

/** "When commented" / "How it was applied" (or "Since then"): the two ways "See in context" shows a thread. */
export function ContextViewSwitch({ thread, view, onChange }: { thread: LineThread; view: ContextView; onChange: (view: ContextView) => void }) {
  const labels = contextViewLabels(thread);
  return (
    <SegmentedControl<ContextView>
      label="What to show"
      value={view}
      onChange={onChange}
      segments={[
        { value: 'commented', label: labels.commented, title: 'The diff the comment was written on' },
        { value: 'since', label: labels.since, title: 'The version commented on, against what it became' },
      ]}
    />
  );
}
