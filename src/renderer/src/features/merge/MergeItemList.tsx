import type { ReactNode } from 'react';
import type { ItemType } from '@shared/domain/pendingChanges';
import { FileTreeCell } from '../../components/FileTreeCell';
import { FileTreeList } from '../../components/FileTreeList';
import { ItemPathRow } from '../../components/ItemPathRow';
import { TreeFolderLabel } from '../../components/TreeFolderLabel';
import type { MenuEntry } from '../../lib/actions';
import type { GroupedTreeRow } from '../../lib/groupedPathTree';
import type { PathTreeRow } from '../../lib/pathTree';
import type { SelectionState } from '../../lib/selection';
import { ConflictStatusChip } from './ConflictStatusChip';
import type { MergeLabels } from './mergeDescription';
import { directoryResolutionOf, fileStateOf, isApplying, MERGE_GROUP_TIPS, type MergeGroup, type MergeItem, type MergeProgress } from './mergeItems';
import { changeTone, describeChange, directoryConflictStatus, fileConflictStatus, fileConflictTool, mergeGroupProgress } from './mergeStatus';

interface MergeItemListProps {
  /** Conflicts, then the changes that apply cleanly, as a list or a tree (`useGroupedFileTree`). */
  rows: GroupedTreeRow<MergeItem, MergeGroup>[];
  /** Where each conflict stands, which its row shows: the rows stay as they are when it changes. */
  progress: MergeProgress;
  tree: boolean;
  toggleCollapsed: (key: string) => void;
  /** What each repository path of the merge is, for its icon (`mergeItemTypes`). */
  typeOf: (path: string) => ItemType;
  labels: MergeLabels;
  query: string;
  filterBar: ReactNode;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  contextMenu: (items: MergeItem[]) => MenuEntry[];
  /** While the filters hide every item: `NoMatches`. */
  noMatches?: ReactNode;
}

/** What the merge does, item by item, as every list of changed files shows its files: in groups, as a list or a tree. */
export function MergeItemList({ rows, progress, tree, toggleCollapsed, typeOf, labels, query, filterBar, selection, onSelectionChange, contextMenu, noMatches }: MergeItemListProps) {

  const renderItem = (row: PathTreeRow<MergeItem>, level: number) => {
    if (row.type === 'folder') {
      return (
        <FileTreeCell depth={level} tree={tree} folder>
          <TreeFolderLabel name={row.name} collapsed={row.collapsed} count={row.items.length - (row.item ? 1 : 0)} extras={row.item && <MergeItemMarks item={row.item} progress={progress} labels={labels} />} />
        </FileTreeCell>
      );
    }
    return (
      <FileTreeCell depth={level} tree={tree} folder={false}>
        <MergeItemRow item={row.item} progress={progress} labels={labels} typeOf={typeOf} nameOnly={row.depth > 0} />
      </FileTreeCell>
    );
  };

  return (
    <FileTreeList
      rows={rows}
      tree={tree}
      toggleCollapsed={toggleCollapsed}
      renderItem={renderItem}
      groupTip={(group) => MERGE_GROUP_TIPS[group]}
      groupProgress={(group, items) => mergeGroupProgress(group, items, progress)}
      query={query}
      filterBar={filterBar}
      selection={selection}
      onSelectionChange={onSelectionChange}
      contextMenu={contextMenu}
      label="Files to merge"
      noMatches={noMatches}
    />
  );
}

/** Every item as in any list of changed files: what the merge does to it as its letter, where its conflict stands before. */
function MergeItemRow({ item, progress, labels, typeOf, nameOnly }: { item: MergeItem; progress: MergeProgress; labels: MergeLabels; typeOf: (path: string) => ItemType; nameOnly: boolean }) {
  switch (item.kind) {
    case 'directoryConflict': {
      const { conflict } = item;
      return (
        <ItemPathRow
          path={item.path}
          nameOnly={nameOnly}
          itemType={conflict.isDirectory ? 'directory' : 'file'}
          status={{ tone: conflict.source.operation, label: `${conflict.title}: ${conflict.source.description}` }}
          extras={<MergeItemMarks item={item} progress={progress} labels={labels} />}
        />
      );
    }
    case 'fileConflict':
      return (
        <ItemPathRow
          path={item.path}
          nameOnly={nameOnly}
          itemType="file"
          status={{ tone: 'changed', label: 'Will be changed: both sides changed it' }}
          extras={<MergeItemMarks item={item} progress={progress} labels={labels} />}
        />
      );
    case 'change':
      return (
        <ItemPathRow
          path={item.path}
          nameOnly={nameOnly}
          itemType={typeOf(item.change.path)}
          oldPath={item.change.oldPath && item.change.oldPath.replace(/^\//, '')}
          status={{ tone: changeTone(item.change), label: describeChange(item.change, labels) }}
        />
      );
  }
}

/** Where a conflict stands; nothing for a change that applies cleanly. */
function MergeItemMarks({ item, progress, labels }: { item: MergeItem; progress: MergeProgress; labels: MergeLabels }) {
  if (item.kind === 'directoryConflict') {
    const { conflict } = item;
    const status = directoryConflictStatus(directoryResolutionOf(item, progress), isApplying(item, progress));
    return (
      <ConflictStatusChip
        status={status}
        labels={labels}
        explanation={status === 'needsDecision' ? `${conflict.title}: ${conflict.explanation}` : undefined}
        compact
      />
    );
  }
  if (item.kind === 'fileConflict') {
    const state = fileStateOf(item, progress);
    return <ConflictStatusChip status={fileConflictStatus(state)} labels={labels} tool={fileConflictTool(state)} compact />;
  }
  return null;
}
