import { MessageSquareDiff } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';
import { lazyComponent } from '../../../lib/lazyComponent';
import { suggestionRows, suggestionTitle, type SuggestedChange } from './suggestedChange';
import { SuggestionRows } from './SuggestionRows';
import { useReplacedLines } from './useReplacedLines';
import styles from './SuggestedChangeBlock.module.css';

// The highlighter (Pierre's Shiki) and the file's language load with the first suggestion shown, never at start-up.
const HighlightedSuggestionRows = lazyComponent(() => import('./HighlightedSuggestionRows').then((module) => module.HighlightedSuggestionRows));

interface SuggestedChangeBlockProps {
  change: SuggestedChange;
  /** What can be done with it, at the end of its header (applying it). */
  actions?: ReactNode;
}

/**
 * A change request's suggestion, in place of its fence (docs/features/code-reviews.md "Suggested changes"): the
 * commented line removed and the suggested lines added, in the diff's colors, highlighted in the file's language. It
 * mounts only with its comment shown whole (a settled thread starts folded to its first words), which is when the line
 * it replaces is read.
 */
export function SuggestedChangeBlock({ change, actions }: SuggestedChangeBlockProps) {
  const rows = suggestionRows(useReplacedLines(change), change.lines);
  const plain = <SuggestionRows rows={rows} />;
  return (
    <figure className={styles.block} aria-label={suggestionTitle(change.lines)}>
      <figcaption className={styles.header}>
        <MessageSquareDiff size={14} aria-hidden />
        <span className={styles.title}>{suggestionTitle(change.lines)}</span>
        {actions && <span className={styles.actions}>{actions}</span>}
      </figcaption>
      <Suspense fallback={plain}>
        <HighlightedSuggestionRows rows={rows} path={change.path} fallback={plain} />
      </Suspense>
    </figure>
  );
}
