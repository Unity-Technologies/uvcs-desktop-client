import type { ContentSource } from '@shared/domain/content';
import type { TreeItem } from '@shared/domain/explorer';
import { EmptyState } from '../../ui/EmptyState';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';

/** What the item's current revision changed compared to the one before it. */
export function RevisionChanges({ workspacePath, item }: { workspacePath: string; item: TreeItem }) {
  if (item.itemType === 'directory') {
    return <EmptyState title="This is a folder" description="Select a file to see its changes." />;
  }

  const current: ContentSource = { kind: 'revision', revisionId: item.revisionId, fileName: item.name };
  const previous: ContentSource =
    item.parentRevisionId > 0 ? { kind: 'revision', revisionId: item.parentRevisionId, fileName: item.name } : { kind: 'empty' };

  return (
    <FileDiffViewer
      key={item.revisionId}
      workspacePath={workspacePath}
      original={previous}
      modified={current}
      fileName={item.name}
      title={item.parentRevisionId > 0 ? `Changed in changeset ${item.changeset}` : `Added in changeset ${item.changeset}`}
    />
  );
}
