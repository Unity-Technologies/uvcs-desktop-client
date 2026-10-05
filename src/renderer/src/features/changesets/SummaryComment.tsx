import { FoldedComment } from '../../components/FoldedComment';
import { splitComment } from '../../lib/comment';
import styles from './ChangesetSummary.module.css';

/**
 * How much of a comment shows over a diff while folded: a long one would push the files and the diff down the window.
 * Expanded, it grows to at most part of the window and scrolls past that, so the diff below stays in sight.
 */
const TITLE_LINES = 2;
const DESCRIPTION_LINES = 3;
const EXPANDED_MAX_HEIGHT = '40vh';

/** A changeset's or shelve's comment over its diff, folded to a few lines with "Show more" (`FoldedComment`). */
export function SummaryComment({ comment }: { comment: string }) {
  const { summary, description } = splitComment(comment);
  return (
    <FoldedComment
      title={summary || <span className={styles.noComment}>No comment</span>}
      titleClassName={styles.title}
      description={description}
      titleLines={TITLE_LINES}
      descriptionLines={DESCRIPTION_LINES}
      expandedMaxHeight={EXPANDED_MAX_HEIGHT}
    />
  );
}
