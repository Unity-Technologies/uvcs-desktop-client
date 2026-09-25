import type { PendingChange } from '@shared/domain/pendingChanges';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../ui/EmptyState';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import { describeKinds } from './changeCategories';
import { changeDiffSources } from './changeDiffSources';
import { changeTone } from './changeTone';

export function ChangeDiffPanel({ workspacePath, change }: { workspacePath: string; change: PendingChange }) {
  const title = (
    <>
      <StatusBadge tone={changeTone(change)} title={describeKinds(change)} />
      <PathLabel path={change.path} oldPath={change.oldPath} />
    </>
  );

  if (change.itemType === 'directory') {
    return <EmptyState title={change.path} description={`Directory · ${describeKinds(change)}`} />;
  }

  const { original, modified } = changeDiffSources(change);
  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={original}
      modified={modified}
      fileName={change.path}
      title={title}
      identicalDescription={change.oldPath ? `Moved from ${change.oldPath} without content changes.` : undefined}
    />
  );
}
