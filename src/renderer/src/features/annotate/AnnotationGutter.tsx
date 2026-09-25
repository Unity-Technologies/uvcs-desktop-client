import type { CSSProperties } from 'react';
import { formatDateTime, formatRelativeDate } from '../../lib/formatDate';
import { displayName } from '../../lib/userName';
import { firstLine } from '../../lib/text';
import { Avatar } from '../../ui/Avatar';
import type { AnnotateColumns } from './annotateOptionsStore';
import type { AnnotationRow } from './annotationRows';
import styles from './AnnotationGutter.module.css';

interface AnnotationGutterProps {
  rows: AnnotationRow[];
  columns: AnnotateColumns;
  lineHeight: number;
  onOpenChangeset: (changesetId: number) => void;
}

/** One cell per code line: an age strip on every line, and who/what/when on the first line of each block. */
export function AnnotationGutter({ rows, columns, lineHeight, onOpenChangeset }: AnnotationGutterProps) {
  const showsDetails = columns.author || columns.changeset || columns.date;

  return (
    <div className={styles.gutter} data-compact={!showsDetails} aria-hidden="true">
      {rows.map((row, index) => {
        const { changeset } = row;
        return (
          <button
            key={index}
            className={styles.cell}
            data-block-start={row.isBlockStart && index > 0}
            style={{ height: lineHeight, '--recency': row.recency } as CSSProperties}
            title={`${changeset.comment.trim() || 'No comment'}\n\n${displayName(changeset.owner)} · cs:${changeset.changesetId} · ${changeset.branch}\n${formatDateTime(changeset.date)}`}
            onClick={() => onOpenChangeset(changeset.changesetId)}
            tabIndex={-1}
          >
            <span className={styles.age} />
            {row.isBlockStart && showsDetails && (
              <>
                {columns.author && <Avatar user={changeset.owner} size={15} />}
                <span className={styles.summary}>
                  {columns.author && <span className={styles.author}>{displayName(changeset.owner)}</span>}
                  <span className={styles.comment}>{firstLine(changeset.comment)}</span>
                </span>
                {columns.changeset && <span className={styles.changeset}>{changeset.changesetId}</span>}
                {columns.date && <span className={styles.date}>{formatRelativeDate(changeset.date)}</span>}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
