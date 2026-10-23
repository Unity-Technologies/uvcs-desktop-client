import { workspacePlace } from '@shared/domain/place';
import type { MergeChange, MergeContributors, MergeRequest } from '@shared/domain/merge';
import { EmptyState } from '../../ui/EmptyState';
import { DiffFileTitle } from '../diff/viewer/DiffFileTitle';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import { changePreviewOf } from './mergeChangeVersions';
import type { MergeLabels } from './mergeDescription';
import { changeTone, describeChange } from './mergeStatus';
import styles from './MergeChangePreview.module.css';

interface MergeChangePreviewProps {
  workspacePath: string;
  request: MergeRequest;
  change: MergeChange;
  contributors: MergeContributors | undefined;
  labels: MergeLabels;
}

/** What a cleanly-applying change will do: the version before against the version it leads to. */
export function MergeChangePreview({ workspacePath, request, change, contributors, labels }: MergeChangePreviewProps) {
  const preview = changePreviewOf(change, contributors, request);
  if (preview.kind === 'permissionsOnly') return <EmptyState title={change.path} description="Only the file permissions will change." />;
  if (preview.kind === 'noVersions') return <EmptyState title={change.path} description={describeChange(change, labels)} />;

  const { original, modified } = preview;
  return (
    <FileDiffViewer
      place={workspacePlace(workspacePath)}
      original={original}
      modified={modified}
      fileName={change.path}
      title={
        <span className={styles.title}>
          <DiffFileTitle
            status={{ tone: changeTone(change), label: describeChange(change, labels) }}
            path={change.path.replace(/^\//, '')}
            oldPath={change.oldPath?.replace(/^\//, '')}
          />
          <span className={styles.outcome}>{describeChange(change, labels)}</span>
        </span>
      }
    />
  );
}
