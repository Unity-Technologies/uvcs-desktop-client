import { ItemStatusMark, type StatusMark } from '../../../components/ItemStatusMark';
import { PathLabel } from '../../../components/PathLabel';
import { movedFrom, movedTitleMarks } from './movedFrom';
import styles from './DiffFileTitle.module.css';

interface DiffFileTitleProps {
  /** What happened to the file: its letters (a C before the M of a moved file that changed) and their tooltips. */
  status: StatusMark;
  path: string;
  /** Where a moved file was. */
  oldPath?: string;
}

/**
 * The file a diff shows, in its header: its status and its path. A moved file reads as its hover does, where it was
 * first and where it is after ("from old.ts to src/new.ts"), what the move changed tinted in each (`movedTitleMarks`,
 * `PathMoveLines`). The path and the M show the whole move on hover.
 */
export function DiffFileTitle({ status, path, oldPath }: DiffFileTitleProps) {
  const marks = oldPath !== undefined ? movedTitleMarks(path, oldPath) : undefined;
  const pathLabel = (
    <PathLabel
      path={path}
      oldPath={oldPath}
      fitContent={oldPath !== undefined}
      moveMarks={marks && { positions: marks.path, tint: 'added' }}
    />
  );
  return (
    <>
      <span className={styles.status}>
        <ItemStatusMark status={status} move={oldPath !== undefined ? { from: oldPath, to: path } : undefined} />
      </span>
      <span className={styles.paths}>
        {oldPath === undefined ? (
          pathLabel
        ) : (
          <>
            <span className={styles.moveEnd}>
              from
              <span className={styles.movePath}>
                <PathLabel
                  path={movedFrom(path, oldPath)}
                  fitContent
                  tooltip={false}
                  moveMarks={marks && { positions: marks.from, tint: 'removed' }}
                />
              </span>
            </span>
            <span className={styles.moveEnd}>
              to
              <span className={styles.movePath}>{pathLabel}</span>
            </span>
          </>
        )}
      </span>
    </>
  );
}
