import { PathLabel } from '../../../components/PathLabel';
import { StatusBadge, type StatusTone } from '../../../components/StatusBadge';
import { movedFrom } from './movedFrom';
import styles from './DiffFileTitle.module.css';

interface DiffFileTitleProps {
  tone: StatusTone;
  /** What happened to the file, the badge's tooltip. */
  status: string;
  path: string;
  /** Where a moved file was. */
  oldPath?: string;
}

/** The file a diff shows, in its header: its status, its path and, moved, where it came from ("from old.ts"). */
export function DiffFileTitle({ tone, status, path, oldPath }: DiffFileTitleProps) {
  return (
    <>
      <StatusBadge tone={tone} title={status} />
      <PathLabel path={path} oldPath={oldPath} fitContent={oldPath !== undefined} />
      {oldPath !== undefined && (
        <span className={styles.from}>
          from
          <PathLabel path={movedFrom(path, oldPath)} fitContent tooltip={false} />
        </span>
      )}
    </>
  );
}
