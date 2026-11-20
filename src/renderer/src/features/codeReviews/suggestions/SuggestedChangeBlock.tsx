import { Diff, FileDiff, MessageSquareDiff, SquareSplitVertical } from 'lucide-react';
import { Suspense, useRef, type ReactNode } from 'react';
import { keepElementInPlace } from '../../../lib/keepInPlace';
import { lazyComponent } from '../../../lib/lazyComponent';
import { IconButton } from '../../../ui/IconButton';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { suggestionBody, suggestionTitle, viewsDiffer, type SuggestedChange } from './suggestedChange';
import { SuggestionPlaceholder } from './SuggestionPlaceholder';
import { useReplacedLines } from './useReplacedLines';
import { useSuggestionViewStore, type SuggestionView } from './suggestionViewStore';
import styles from './SuggestedChangeBlock.module.css';

// Pierre, its highlighter and the file's language load with the first suggestion shown, never at start-up.
const SuggestionDiff = lazyComponent(() => import('./SuggestionDiff').then((module) => module.SuggestionDiff));

interface SuggestedChangeBlockProps {
  change: SuggestedChange;
  /** What can be done with it, at the end of its header (applying it). */
  actions?: ReactNode;
}

/**
 * A change request's suggestion, in place of its fence (docs/features/code-reviews.md "Suggested changes"): the
 * commented lines removed and the suggested lines added, as the code's diff shows them (`suggestionBody`). It mounts
 * only with its comment shown whole (a settled thread starts folded to its first words), which is when the lines it
 * replaces are read.
 */
export function SuggestedChangeBlock({ change, actions }: SuggestedChangeBlockProps) {
  const body = suggestionBody(change, useReplacedLines(change));
  const { view, setView } = useSuggestionViewStore();
  const block = useRef<HTMLElement | null>(null);
  // Every suggestion shown resizes: this one, the one the user is reading, stays where it is on screen.
  const showAs = (next: SuggestionView): void => (block.current ? keepElementInPlace(block.current, () => setView(next)) : setView(next));
  return (
    <figure ref={block} className={styles.block} aria-label={suggestionTitle(change)}>
      <figcaption className={styles.header}>
        <MessageSquareDiff size={14} aria-hidden />
        <span className={styles.title}>{suggestionTitle(change)}</span>
        <span className={styles.controls}>
          {body.kind === 'diff' && (
            <>
              {viewsDiffer(body) && <SegmentedControl<SuggestionView> dense label="Show the suggestion" value={view} onChange={showAs} segments={SUGGESTION_VIEWS} />}
              <IconButton
                size="small"
                icon={<FileDiff size={14} />}
                label="Compare in a larger view"
                // Loaded on the click, with the dialog and Pierre's diff: never with the comment.
                onClick={() => void import('./openSuggestionComparison').then((module) => module.openSuggestionComparison(change, body))}
              />
            </>
          )}
          {actions}
        </span>
      </figcaption>
      {body.kind === 'reading' && <SuggestionPlaceholder rowCount={body.rowCount} />}
      {body.kind === 'unchanged' && <p className={styles.note}>{body.note}</p>}
      {body.kind === 'diff' && (
        <Suspense fallback={<SuggestionPlaceholder rowCount={body.rowCount} />}>
          <SuggestionDiff path={change.path} body={body} />
        </Suspense>
      )}
    </figure>
  );
}

/** The box's two views, named as what they show (`SuggestionView`). */
const SUGGESTION_VIEWS = [
  { value: 'stacked' as const, label: <><SquareSplitVertical size={12} aria-hidden /> Stacked</>, title: 'Every line commented, then every line suggested' },
  { value: 'diff' as const, label: <><Diff size={12} aria-hidden /> Diff</>, title: 'Only what changed, line by line' },
];
