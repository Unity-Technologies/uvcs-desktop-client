import type { ReactNode } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { FileTreeCell } from '../../components/FileTreeCell';
import { ItemPathRow } from '../../components/ItemPathRow';
import { TreeFolderLabel } from '../../components/TreeFolderLabel';
import type { PathTreeRow } from '../../lib/pathTree';
import { diffEntryStatus } from './diffEntrySources';

interface DiffEntryRowProps {
  row: PathTreeRow<DiffEntry>;
  tree: boolean;
  /** The review mark, in review mode. */
  extras?: ReactNode;
  faded?: boolean;
}

/** A file or folder of a diff's changed files, as a list or a tree shows it. */
export function DiffEntryRow({ row, tree, extras, faded }: DiffEntryRowProps) {
  if (row.type === 'folder') {
    const status = row.item && diffEntryStatus(row.item);
    return (
      <FileTreeCell depth={row.depth} tree={tree} folder>
        <TreeFolderLabel
          name={row.name}
          collapsed={row.collapsed}
          count={row.items.length - (row.item ? 1 : 0)}
          status={status}
          deleted={status?.tone === 'deleted'}
          extras={extras}
          faded={faded}
        />
      </FileTreeCell>
    );
  }
  const entry = row.item;
  return (
    <FileTreeCell depth={row.depth} tree={tree} folder={false}>
      <ItemPathRow path={entry.path} itemType={entry.itemType} oldPath={entry.oldPath} nameOnly={row.depth > 0} status={diffEntryStatus(entry)} faded={faded} extras={extras} />
    </FileTreeCell>
  );
}
