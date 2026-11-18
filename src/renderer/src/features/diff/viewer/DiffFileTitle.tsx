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
 * The file a diff shows, in its header: its status, its path and, moved, where it came from ("from old.ts"). The path
 * and the M show the whole move on hover; what it changed is tinted in both, as there (`movedTitleMarks`, `PathMoveLines`).
 */
export function DiffFileTitle({ status, path, oldPath }: DiffFileTitleProps) {
  const marks = oldPath !== undefined ? movedTitleMarks(path, oldPath) : undefined;
  return (
    <>
      <span className={styles.status}>
        <ItemStatusMark status={status} move={oldPath !== undefined ? { from: oldPath, to: path } : undefined} />
      </span>
      <span className={styles.paths}>
        <PathLabel path={path} oldPath={oldPath} fitContent={oldPath !== undefined} moveMarks={marks && { positions: marks.path, tint: 'added' }} />
        {oldPath !== undefined && (
          <span className={styles.from}>
            from
            <span className={styles.fromPath}>
              <PathLabel path={movedFrom(path, oldPath)} fitContent tooltip={false} moveMarks={marks && { positions: marks.from, tint: 'removed' }} />
            </span>
          </span>
        )}
      </span>
    </>
  );
}
