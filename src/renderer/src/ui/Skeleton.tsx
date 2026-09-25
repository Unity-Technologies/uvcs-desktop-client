import type { ReactNode } from 'react';
import styles from './Skeleton.module.css';

/** Enough rows to fill a tall window; the rest is clipped. */
const ROWS = 32;
const WIDTHS = [62, 48, 78, 55, 70, 40, 84, 58];

/** A stable, varied width for a placeholder bar, so rows don't look stamped out. */
export function skeletonWidth(row: number, column = 0): string {
  return `${WIDTHS[(row * 3 + column * 5) % WIDTHS.length]}%`;
}

/** A pulsing bar standing for a line of text. */
export function SkeletonBar({ width }: { width: string }) {
  return <span className={styles.bar} style={{ width }} />;
}

interface SkeletonRowsProps {
  /** The real rows' height, so nothing jumps when they arrive. */
  rowHeight: number;
  /** Extra class for each row, e.g. the real list's row class for its insets. */
  rowClassName?: string;
  children: (index: number) => ReactNode;
}

/** Placeholder rows filling the space of a list that is loading. */
export function SkeletonRows({ rowHeight, rowClassName, children }: SkeletonRowsProps) {
  return (
    <div className={styles.rows} aria-busy="true" aria-label="Loading">
      {Array.from({ length: ROWS }, (_, index) => (
        <div key={index} className={[styles.row, rowClassName].filter(Boolean).join(' ')} style={{ height: rowHeight }}>
          {children(index)}
        </div>
      ))}
    </div>
  );
}

/** A loading list of files or items: a status mark and a line of text per row. */
export function ListSkeleton({ rowHeight }: { rowHeight: number }) {
  return (
    <SkeletonRows rowHeight={rowHeight} rowClassName={styles.listRow}>
      {(index) => (
        <>
          <span className={`${styles.bar} ${styles.mark}`} />
          <SkeletonBar width={skeletonWidth(index)} />
        </>
      )}
    </SkeletonRows>
  );
}
