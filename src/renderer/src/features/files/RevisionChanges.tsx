import { useMemo, type ReactNode } from 'react';
import type { Place } from '@shared/domain/place';
import type { ContentSource } from '@shared/domain/content';
import type { TreeItem } from '@shared/domain/explorer';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { inWorkspaceRepository } from '@shared/domain/repository';
import { AssetsPointContext, lastChangeAssetsPoint } from '../diff/viewer/model/assetsPoints';
import { SiblingFinderContext } from '../diff/viewer/model/modelSiblings';
import { lastChangeSibling } from './lastChangeSibling';

interface RevisionChangesProps {
  place: Place;
  item: TreeItem;
  /** The tree's listings, by folder: where a model finds the files it needs beside it (`lastChangeSibling`). */
  listings: ReadonlyMap<string, TreeItem[]>;
  /** The toolbar's title: what is compared. */
  title: ReactNode;
}

/**
 * What the item's revision changed: against its parent revision, which the tree's listing names (the one History's
 * `parentRevision` looks for first), or against nothing for the revision that added it. Both are read once, in the
 * item's repository, by their path, which a model's siblings are found beside.
 */
export function RevisionChanges({ place, item, listings, title }: RevisionChangesProps) {
  const { repository } = item;
  const current: ContentSource = { kind: 'revision', revision: { revisionId: item.revisionId, repository }, fileName: item.path };
  const previous: ContentSource =
    item.parentRevisionId > 0 ? { kind: 'revision', revision: { revisionId: item.parentRevisionId, repository }, fileName: item.path } : { kind: 'empty' };
  const findSibling = useMemo(() => lastChangeSibling(item, listings), [item, listings]);
  const inWorkspace = inWorkspaceRepository(repository, useWorkspaceInfo().data?.repository);
  const findAssetsPoint = useMemo(() => lastChangeAssetsPoint(item.changeset, repository, inWorkspace), [item.changeset, repository, inWorkspace]);

  return (
    <SiblingFinderContext.Provider value={findSibling}>
      <AssetsPointContext.Provider value={findAssetsPoint}>
        <FileDiffViewer place={place} original={previous} modified={current} fileName={item.name} title={title} />
      </AssetsPointContext.Provider>
    </SiblingFinderContext.Provider>
  );
}
