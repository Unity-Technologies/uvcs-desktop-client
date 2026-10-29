import { CommentLine } from '../../components/comments/CommentLine';
import { FoldedComment } from '../../components/FoldedComment';
import { commentHeading, wholeCopySource } from '../../lib/comments/commentHeading';
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
  const heading = commentHeading(comment);
  return (
    <FoldedComment
      title={heading.kind === 'titled' ? <CommentLine comment={comment} /> : heading.kind === 'block' ? undefined : <span className={styles.noComment}>No comment</span>}
      titleClassName={styles.title}
      description={heading.kind === 'empty' ? '' : heading.description}
      titleLines={TITLE_LINES}
      descriptionLines={DESCRIPTION_LINES}
      expandedMaxHeight={EXPANDED_MAX_HEIGHT}
      comment={wholeCopySource(heading, comment, false)}
    />
  );
}
