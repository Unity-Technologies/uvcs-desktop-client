import type { ReactNode } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { FileTreeCell } from '../../components/FileTreeCell';
import { MetaTag } from '../../components/MetaTag';
import { ItemPathRow } from '../../components/ItemPathRow';
import { TreeFolderLabel } from '../../components/TreeFolderLabel';
import { folderItemCount, type PathTreeRow } from '../../lib/pathTree';
import { diffEntryStatus } from './diffEntrySources';

interface DiffEntryRowProps {
  row: PathTreeRow<DiffEntry>;
  /** How far in it sits (`groupedRowLevel`): its depth, one more inside a group. */
  level?: number;
  tree: boolean;
  /** The review mark, in review mode. */
  extras?: ReactNode;
  faded?: boolean;
  /** Its Unity `.meta` changed too, and rides on its row (`pairDiffMetas`). */
  hasMeta?: boolean;
}

/** A file or folder of a diff's changed files, as a list or a tree shows it. */
export function DiffEntryRow({ row, level = row.depth, tree, extras, faded, hasMeta }: DiffEntryRowProps) {
  const tagged = hasMeta ? (
    <>
      <MetaTag />
      {extras}
    </>
  ) : (
    extras
  );
  if (row.type === 'folder') {
    const status = row.item && diffEntryStatus(row.item);
    return (
      <FileTreeCell depth={level} tree={tree} folder>
        <TreeFolderLabel
          name={row.name}
          collapsed={row.collapsed}
          count={folderItemCount(row)}
          status={status}
          deleted={status?.tone === 'deleted'}
          extras={tagged}
          faded={faded}
        />
      </FileTreeCell>
    );
  }
  const entry = row.item;
  return (
    <FileTreeCell depth={level} tree={tree} folder={false}>
      <ItemPathRow path={entry.path} itemType={entry.itemType} oldPath={entry.oldPath} nameOnly={row.depth > 0} status={diffEntryStatus(entry)} faded={faded} extras={tagged} />
    </FileTreeCell>
  );
}
