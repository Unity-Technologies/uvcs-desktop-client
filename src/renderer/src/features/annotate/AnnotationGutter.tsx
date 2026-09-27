import { GalleryHorizontalEnd } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ItemRevision } from '@shared/domain/history';
import { formatDateTime, formatRelativeDate } from '../../lib/formatDate';
import { displayName } from '../../lib/userName';
import { firstLine } from '../../lib/text';
import { Avatar } from '../../ui/Avatar';
import type { AnnotateColumns } from './annotateOptionsStore';
import type { AnnotationRow } from './annotationRows';
import type { RowRange } from './visibleRows';
import styles from './AnnotationGutter.module.css';

/** Walks the annotation back to the file as it was before a line's change. */
export interface AnnotateBefore {
  /** The revision to annotate instead, if the history has one before `changesetId`. */
  revisionBefore: (changesetId: number) => ItemRevision | undefined;
  annotate: (revision: ItemRevision) => void;
}

interface AnnotationGutterProps {
  rows: AnnotationRow[];
  columns: AnnotateColumns;
  lineHeight: number;
  /** The rows in view: only they are rendered, the rest keep their room. */
  range: RowRange;
  onOpenChangeset: (changesetId: number) => void;
  annotateBefore?: AnnotateBefore;
}

/** One cell per code line: an age strip on every line, and who/what/when on the first line of each block. */
export function AnnotationGutter({ rows, columns, lineHeight, range, onOpenChangeset, annotateBefore }: AnnotationGutterProps) {
  const showsDetails = columns.author || columns.changeset || columns.date;

  return (
    <div className={styles.gutter} data-compact={!showsDetails} aria-hidden="true">
      <div style={{ height: range.first * lineHeight }} />
      {rows.slice(range.first, range.end).map((row, offset) => {
        const index = range.first + offset;
        const { changeset } = row;
        const showsBlock = row.isBlockStart && showsDetails;
        return (
          <div
            key={index}
            className={styles.cell}
            data-block-start={row.isBlockStart && index > 0}
            style={{ height: lineHeight, '--recency': row.recency } as CSSProperties}
          >
            <button
              className={styles.open}
              data-tip={`${changeset.comment.trim() || 'No comment'}\n\n${displayName(changeset.owner)} · cs:${changeset.changesetId} · ${changeset.branch}\n${formatDateTime(changeset.date)}`}
              onClick={() => onOpenChangeset(changeset.changesetId)}
              tabIndex={-1}
            >
              <span className={styles.age} />
              {showsBlock && (
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
            {showsDetails && annotateBefore && (
              <AnnotateBeforeButton changesetId={changeset.changesetId} visible={row.isBlockStart} annotateBefore={annotateBefore} />
            )}
          </div>
        );
      })}
      <div style={{ height: (rows.length - range.end) * lineHeight }} />
    </div>
  );
}

/** Always takes its slot, so the dates stay aligned down the gutter whether or not there is an earlier revision. */
function AnnotateBeforeButton({ changesetId, visible, annotateBefore }: { changesetId: number; visible: boolean; annotateBefore: AnnotateBefore }) {
  const revision = visible ? annotateBefore.revisionBefore(changesetId) : undefined;
  if (!revision) return <span className={styles.before} />;
  return (
    <button
      className={styles.before}
      data-tip={`Annotate before this change\nThe file as of cs:${revision.changesetId}`}
      onClick={() => annotateBefore.annotate(revision)}
      aria-label="Annotate before this change"
      tabIndex={-1}
    >
      <GalleryHorizontalEnd size={13} />
    </button>
  );
}
