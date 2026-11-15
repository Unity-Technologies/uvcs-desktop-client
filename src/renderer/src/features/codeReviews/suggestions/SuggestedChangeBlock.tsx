import { MessageSquareDiff } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { lazyComponent } from '../../../lib/lazyComponent';
import { suggestionBody, suggestionTitle, type SuggestedChange } from './suggestedChange';
import { SuggestionPlaceholder } from './SuggestionPlaceholder';
import { useReplacedLines } from './useReplacedLines';
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
  return (
    <figure className={styles.block} aria-label={suggestionTitle(change)}>
      <figcaption className={styles.header}>
        <MessageSquareDiff size={14} aria-hidden />
        <span className={styles.title}>{suggestionTitle(change)}</span>
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
