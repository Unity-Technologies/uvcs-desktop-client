import { ArrowDownToLine } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PartialIncomingChanges, PartialIncomingItem } from '@shared/domain/incoming';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { FileTreeCell } from '../../components/FileTreeCell';
import { FileTreeList } from '../../components/FileTreeList';
import { ItemPathRow } from '../../components/ItemPathRow';
import { TreeFolderLabel } from '../../components/TreeFolderLabel';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useGroupedFileTree } from '../../components/useGroupedFileTree';
import { branchLabel } from '../../lib/branchLabels';
import { hidesEveryRow } from '../../lib/hidesEveryRow';
import { itemsIn } from '../../lib/itemRange';
import { folderItemCount, type PathTreeRow } from '../../lib/pathTree';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { EmptyState } from '../../ui/EmptyState';
import { NoMatches } from '../../ui/NoMatches';
import { IncomingFileDiff } from './IncomingDetail';
import { IncomingPanes } from './IncomingPanes';
import { updatePartialToIncoming } from './updateOperations';
import { firstPartialItemKey, partialItemGroups, partialItemKey, partialSelectionDetail } from './partialIncomingItems';
import {
  canUpdateSelection,
  partialGroupCheckState,
  partialItemChecked,
  partialUpdateMessage,
  partialUpdateSelection,
  withItemsChecked,
  type UncheckedItems,
} from './partialIncomingSelection';
import { PARTIAL_ITEM_FACTS, PARTIAL_VIEW_OFFER, partialItemAt, partialItemStatus, partialItemTones, partialItemTreeGroups } from './partialIncomingTree';
import barStyles from './UpdateBar.module.css';

interface PartialIncomingSessionProps {
  workspacePath: string;
  incoming: PartialIncomingChanges;
  /** The view's header, saying the words given. */
  header: (subtitle: string) => ReactNode;
}

const pathOf = (item: PartialIncomingItem): string => item.path;

/**
 * Incoming in a partial workspace: it loads no one changeset, so it lists the items the branch head would change,
 * grouped by what the branch did to them, as every list of changed files does, with each item's diff, and updates to
 * the items checked.
 */
export function PartialIncomingSession({ workspacePath, incoming, header }: PartialIncomingSessionProps) {
  const repository = useWorkspaceInfo().data?.repository;
  const items = incoming.items;
  const filter = useChangeFilter(items, pathOf, partialItemTones, { isViewFilter: true, viewOffer: PARTIAL_VIEW_OFFER });
  const content = useMemo(() => ({ groups: partialItemTreeGroups(partialItemGroups(filter.visible)) }), [filter.visible]);
  const hidesAll = hidesEveryRow(items.length, filter.visible.length);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const { rows, tree, toggleCollapsed, rowKeyOf, folding } = useGroupedFileTree(
    content,
    items,
    partialItemKey,
    folderListScope(workspacePath, 'incoming:partial'),
    PARTIAL_ITEM_FACTS,
    selection.anchor,
  );
  const selected = partialItemAt(items, rows, selection.anchor);
  const detail = partialSelectionDetail(items, selected ? partialItemKey(selected) : null, repository);

  useEffect(() => {
    const first = firstPartialItemKey(partialItemGroups(items));
    if (!selection.anchor && first) setSelection(singleSelection(rowKeyOf(first)));
  }, [selection.anchor, items, rowKeyOf]);

  const [unchecked, setUnchecked] = useState<UncheckedItems>(() => new Set());
  const toBring = useMemo(() => partialUpdateSelection(items, unchecked), [items, unchecked]);
  const [updating, setUpdating] = useState(false);
  const update = async () => {
    setUpdating(true);
    try {
      await updatePartialToIncoming(workspacePath, incoming, toBring);
    } finally {
      setUpdating(false);
    }
  };

  const checkboxFor = (held: readonly PartialIncomingItem[], label: string) => (
    <Checkbox
      checked={partialGroupCheckState(held, unchecked)}
      ariaLabel={label}
      focusable={false}
      onChange={(checked) => setUnchecked(withItemsChecked(unchecked, held, checked))}
    />
  );

  const renderItem = (row: PathTreeRow<PartialIncomingItem>, level: number) => {
    if (row.type === 'folder') {
      return (
        <FileTreeCell depth={level} tree={tree} folder>
          <TreeFolderLabel
            name={row.name}
            collapsed={row.collapsed}
            count={folderItemCount(row)}
            before={checkboxFor(itemsIn(row.held), `Bring everything in ${row.path}`)}
            status={row.item && partialItemStatus(row.item)}
            deleted={row.item?.kind === 'removed'}
          />
        </FileTreeCell>
      );
    }
    const item = row.item;
    return (
      <FileTreeCell depth={level} tree={tree} folder={false}>
        <Checkbox
          checked={partialItemChecked(item, unchecked)}
          ariaLabel={`Bring ${item.path}`}
          focusable={false}
          onChange={(checked) => setUnchecked(withItemsChecked(unchecked, [item], checked))}
        />
        <ItemPathRow path={item.path} itemType={item.isDirectory ? 'directory' : 'file'} nameOnly={row.depth > 0} oldPath={item.oldPath} status={partialItemStatus(item)} />
      </FileTreeCell>
    );
  };

  return (
    <>
      {header(`${pluralize(items.length, 'item')} from ${branchLabel(incoming.branch)}`)}
      <div className={barStyles.bar}>
        <ArrowDownToLine size={15} className={barStyles.icon} />
        <span className={barStyles.text}>{partialUpdateMessage(incoming.branch, toBring, unchecked)}</span>
        {canUpdateSelection(toBring) && (
          <Button variant="primary" loading={updating} onClick={() => void update()}>
            Update workspace
          </Button>
        )}
      </div>
      <IncomingPanes
        list={
          <FileTreeList
            rows={rows}
            tree={tree}
            toggleCollapsed={toggleCollapsed}
            folding={folding}
            renderItem={renderItem}
            groupBefore={(group, held) => checkboxFor(itemsIn(held), `Bring every item in ${group}`)}
            query={filter.query}
            filterBar={filter.bar}
            selection={selection}
            onSelectionChange={setSelection}
            label="Incoming items"
            noMatches={hidesAll && <NoMatches noun="items" onClear={filter.clear} />}
          />
        }
        detail={
          detail.kind === 'diff' ? (
            <IncomingFileDiff key={detail.entry.path} workspacePath={workspacePath} file={detail.entry} />
          ) : (
            <EmptyState title={detail.title} />
          )
        }
      />
    </>
  );
}
