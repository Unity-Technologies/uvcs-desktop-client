import { FileDiff } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry } from '@shared/domain/diff';
import { navigation } from '../../app/navigation/navigationStore';
import { PathLabel } from '../../components/PathLabel';
import { formatDateTime } from '../../lib/formatDate';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import styles from './IncomingDetail.module.css';

export function IncomingChangesetDetail({ changeset }: { changeset: Changeset }) {
  return (
    <div className={styles.changeset}>
      <span className={styles.changesetId}>Changeset {changeset.id}</span>
      <p className={`${styles.comment} selectable`}>{changeset.comment || 'No comment'}</p>
      <div className={styles.meta}>
        <UserLabel user={changeset.owner} />
        <span>{formatDateTime(changeset.date)}</span>
        <span>{changeset.branch}</span>
      </div>
      <Button
        icon={<FileDiff size={14} />}
        onClick={() => navigation.openPage({ kind: 'diff', title: `Changeset ${changeset.id}`, target: { kind: 'changeset', changesetId: changeset.id } })}
      >
        View its changes
      </Button>
    </div>
  );
}

/** What an incoming change does to a file: the loaded version against the branch head. */
export function IncomingFileDiff({ workspacePath, file }: { workspacePath: string; file: DiffEntry }) {
  const version = (revisionId: number): ContentSource =>
    revisionId < 0 ? { kind: 'empty' } : { kind: 'revision', revisionId, fileName: file.path };

  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={version(file.baseRevisionId)}
      modified={version(file.revisionId)}
      fileName={file.path}
      title={<PathLabel path={file.path} oldPath={file.oldPath} />}
    />
  );
}
