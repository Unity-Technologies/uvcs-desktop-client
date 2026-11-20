import { Diff, GitCompareArrows, MessageSquareDiff } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { lazyComponent } from '../../../lib/lazyComponent';
import { IconButton } from '../../../ui/IconButton';
import { suggestionBody, suggestionTitle, type SuggestedChange } from './suggestedChange';
import { SuggestionPlaceholder } from './SuggestionPlaceholder';
import { useReplacedLines } from './useReplacedLines';
import { suggestionViewToggle } from './suggestionViewToggle';
import { useSuggestionViewStore } from './suggestionViewStore';
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
  const toggle = suggestionViewToggle(view);
  return (
    <figure className={styles.block} aria-label={suggestionTitle(change)}>
      <figcaption className={styles.header}>
        <MessageSquareDiff size={14} aria-hidden />
        <span className={styles.title}>{suggestionTitle(change)}</span>
        {body.kind === 'diff' && (
          <>
            <IconButton size="small" icon={<Diff size={14} />} label={toggle.label} variant={toggle.pressed ? 'secondary' : 'ghost'} aria-pressed={toggle.pressed} onClick={() => setView(toggle.next)} />
            <IconButton
              size="small"
              icon={<GitCompareArrows size={14} />}
              label="Compare suggestion"
              // Loaded on the click, with the dialog and Pierre's diff: never with the comment.
              onClick={() => void import('./openSuggestionComparison').then((module) => module.openSuggestionComparison(change, body))}
            />
          </>
        )}
        {actions && <span className={styles.actions}>{actions}</span>}
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
