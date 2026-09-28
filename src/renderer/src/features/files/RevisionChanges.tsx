import type { ReactNode } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { TreeItem } from '@shared/domain/explorer';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';

interface RevisionChangesProps {
  workspacePath: string;
  item: TreeItem;
  /** The toolbar's title: what is compared. */
  title: ReactNode;
}

/**
 * What the item's revision changed: against its parent revision, which the tree's listing names (the one History's
 * `parentRevision` looks for first), or against nothing for the revision that added it. Both are read once, in the
 * item's repository.
 */
export function RevisionChanges({ workspacePath, item, title }: RevisionChangesProps) {
  const { repository } = item;
  const current: ContentSource = { kind: 'revision', revision: { revisionId: item.revisionId, repository }, fileName: item.name };
  const previous: ContentSource =
    item.parentRevisionId > 0 ? { kind: 'revision', revision: { revisionId: item.parentRevisionId, repository }, fileName: item.name } : { kind: 'empty' };

  return <FileDiffViewer workspacePath={workspacePath} original={previous} modified={current} fileName={item.name} title={title} />;
}
