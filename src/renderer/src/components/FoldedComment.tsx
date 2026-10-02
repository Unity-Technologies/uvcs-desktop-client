import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { looksLikeMarkdown } from '../lib/comment';
import { foldedCut, isCut } from './foldedCut';
import { Markdown } from './Markdown';
import styles from './FoldedComment.module.css';

interface FoldedCommentProps {
  /** The comment's first line (or an object's name), styled by the caller with `titleClassName`. */
  title: ReactNode;
  titleClassName: string;
  /** The rest of the comment, rendered as Markdown when it was written as such (`looksLikeMarkdown`). */
  description: string;
  /** How many lines of the title and of the description show while folded. */
  titleLines: number;
  descriptionLines: number;
  /** How tall the expanded description may grow before it scrolls; unset, it grows to its full length. */
  expandedMaxHeight?: string;
  /** Shown under the description (a details panel's "Add a description…"). */
  children?: ReactNode;
}

/**
 * A comment's title and description folded to a few lines each, with one "Show more" once either doesn't fit and
 * "Show less" to fold it again. Read the same in a details panel (`DetailsHeading`) and over a diff
 * (`ChangesetSummary`, `ShelveSummary`).
 */
export function FoldedComment({ title, titleClassName, description, titleLines, descriptionLines, expandedMaxHeight, children }: FoldedCommentProps) {
  const [expanded, setExpanded] = useState(false);
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
      <h2 ref={titleRef} className={`${styles.title} ${titleClassName} selectable`} style={{ WebkitLineClamp: expanded ? 'none' : titleLines }}>
        {title}
      </h2>
      {description && (
        <div ref={descriptionRef} className={`${styles.description} selectable`} data-cut={cut.description}>
          {looksLikeMarkdown(description) ? <Markdown text={description} /> : <p className={styles.plain}>{description}</p>}
        </div>
      )}
      {children}
      {(cut.title || cut.description) && (
        <button className={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
