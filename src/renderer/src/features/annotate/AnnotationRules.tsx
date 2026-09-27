import type { AnnotationBlock } from './annotationBlocks';
import type { RowRange } from './visibleRows';
import styles from './AnnotationRules.module.css';

interface AnnotationRulesProps {
  blocks: readonly AnnotationBlock[];
  /** The blocks in view, as block indexes. */
  shown: RowRange;
  lineHeight: number;
  /** The changeset whose lines stand out across the code too. */
  highlighted: number | null;
}

/**
 * Drawn over the gutter and the code together, in the same scrolled content, so nothing drifts: a hairline where one
 * block ends and the next starts, across the whole width, and a tint on the lines of the highlighted changeset.
 */
export function AnnotationRules({ blocks, shown, lineHeight, highlighted }: AnnotationRulesProps) {
  return (
    <div className={styles.rules} aria-hidden="true">
      {blocks.slice(shown.first, shown.end).map((block) => (
        <div
          key={block.start}
          className={styles.block}
          data-first={block.start === 0}
          data-highlighted={block.changeset.changesetId === highlighted}
          style={{ top: block.start * lineHeight, height: (block.end - block.start) * lineHeight }}
        />
      ))}
    </div>
  );
}
