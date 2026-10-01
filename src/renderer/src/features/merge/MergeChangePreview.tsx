import type { ContentSource } from '@shared/domain/content';
import { mergeSourcePoint, type MergeChange, type MergeContributors, type MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import { EmptyState } from '../../ui/EmptyState';
import { DiffFileTitle } from '../diff/viewer/DiffFileTitle';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
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
  if (!contributors || change.kind === 'permissions') {
    return <EmptyState title={change.path} description="Only the file permissions will change." />;
  }

  const { original, modified } = versionsToCompare(change, contributors, request);
  return (
    <FileDiffViewer
      workspacePath={workspacePath}
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

function versionsToCompare(change: MergeChange, contributors: MergeContributors, request: MergeRequest): { original: ContentSource; modified: ContentSource } {
  const source = mergeSourcePoint(request, contributors.source.changesetId);
  const destination = spec.changeset(contributors.destination.changesetId);
  const ancestor = spec.changeset(contributors.base?.changesetId ?? contributors.destination.changesetId);
  const at = (path: string, pointSpec: string): ContentSource => ({ kind: 'repositoryPath', path, at: pointSpec });

  // Undoing a changeset takes the destination back to the ancestor's content.
  if (request.kind === 'subtractive' && (change.kind === 'changed' || change.kind === 'moved')) {
    return { original: at(change.oldPath ?? change.path, destination), modified: at(change.path, ancestor) };
  }

  switch (change.kind) {
    case 'added':
      return { original: { kind: 'empty' }, modified: at(change.path, source) };
    case 'deleted':
      return { original: at(change.path, destination), modified: { kind: 'empty' } };
    default:
      return { original: at(change.oldPath ?? change.path, ancestor), modified: at(change.path, source) };
  }
}
