import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { copyAsSource } from './comments/copyAsSource';
import { foldedCut, isCut } from './foldedCut';
import { Markdown } from './Markdown';
import styles from './FoldedComment.module.css';

interface FoldedCommentProps {
  /** The comment's first line (or an object's name), styled by the caller with `titleClassName`. */
  /** Left out for a comment that opens with a block (`commentHeading`), which shows whole as its description. */
  title?: ReactNode;
  titleClassName: string;
  /** The rest of the comment, rendered as a comment's Markdown (docs/features/rich-comments.md). */
  description: string;
  /** How many lines of the title and of the description show while folded. */
  titleLines: number;
  descriptionLines: number;
  /** How tall the expanded description may grow before it scrolls; unset, it grows to its full length. */
  expandedMaxHeight?: string;
  /** Shown under the description (a details panel's "Add a description…"). */
  children?: ReactNode;
  /** The comment as written, when the title and the description are its parts: copying both gives it back. */
  comment?: string;
}

/**
 * A comment's title and description folded to a few lines each, with one "Show more" once either doesn't fit and
 * "Show less" to fold it again. Read the same in a details panel (`DetailsHeading`) and over a diff
 * (`ChangesetSummary`, `ShelveSummary`). What is cut is measured for the comment it first shows: a place that shows
 * another object's comment instead keys it by that object, as the details panels and `TargetDiff` do.
 */
export function FoldedComment({ title, titleClassName, description, titleLines, descriptionLines, expandedMaxHeight, children, comment }: FoldedCommentProps) {
  const [expanded, setExpanded] = useState(false);
  const copyWhole = useMemo(() => (comment === undefined ? undefined : copyAsSource(comment)), [comment]);
  const [cut, setCut] = useState({ title: false, description: false });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const measure = (): void => setCut((current) => foldedCut(current, { title: isCut(titleRef.current), description: isCut(descriptionRef.current) }));
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [titleRef.current, descriptionRef.current]) if (element) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const sizes = { '--folded-description-lines': descriptionLines, '--folded-expanded-max-height': expandedMaxHeight ?? 'none' } as CSSProperties;

  return (
    <div className={styles.folded} data-expanded={expanded} style={sizes}>
      {/* Its own box, so a copy of the whole comment reads only the comment (`copyAsSource`), not the buttons below. */}
      <div className={styles.comment} onCopy={copyWhole}>
        {title !== undefined && (
          <h2 ref={titleRef} className={`${styles.title} ${titleClassName} selectable`} style={{ WebkitLineClamp: expanded ? 'none' : titleLines }}>
            {title}
          </h2>
        )}
        {description && (
          <div ref={descriptionRef} className={`${styles.description} selectable`} data-cut={cut.description}>
            <Markdown text={description} comment />
          </div>
        )}
      </div>
      {children}
      {(cut.title || cut.description) && (
        <button className={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
