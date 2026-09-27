import { ItemIcon } from '../../components/ItemIcon';
import { ItemRow } from '../../components/ItemRow';
import { ItemStatusMark } from '../../components/ItemStatusMark';
import { PathLabel } from '../../components/PathLabel';
import type { MenuEntry } from '../../lib/actions';
import { fuzzyMatchPositions } from '../../lib/fuzzyIndex';
import type { SelectionState } from '../../lib/selection';
import { hotkeys } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { itemDecoration } from './itemDecoration';
import { changeStatus, type PendingChangesIndex } from './itemStatus';
import type { FoundItem } from './workspaceFind';

const rowKey = (item: FoundItem): string => item.path;

interface FileFindResultsProps {
  items: readonly FoundItem[];
  query: string;
  pendingIndex: PendingChangesIndex;
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  /** Enter or a double click: the item selected in the tree, the find done. */
  onReveal: (path: string) => void;
  /** Esc: the find cleared, back to the tree. */
  onLeave: () => void;
  /** ⌘F or / again: back to the field. */
  onFind: () => void;
  contextMenu: (paths: string[]) => MenuEntry[];
}

/** What the Files find found in the whole workspace, in the tree's place: each item by its path, with its status. */
export function FileFindResults({ items, query, pendingIndex, selection, onSelectionChange, onReveal, onLeave, onFind, contextMenu }: FileFindResultsProps) {
  const columns: Column<FoundItem>[] = [
    {
      id: 'path',
      header: 'Path',
      render: (item) => {
        const change = pendingIndex.changeAt(item.path);
        const { status, presence } = itemDecoration({ isPrivate: false }, change ? changeStatus(change) : null);
        return (
          <ItemRow
            icon={<ItemIcon itemType={item.isDirectory ? 'directory' : 'file'} name={item.path} />}
            label={<PathLabel path={item.path} matches={fuzzyMatchPositions(item.path, query)} fitContent />}
            status={<ItemStatusMark status={status} changesInside={item.isDirectory && pendingIndex.hasChangesInside(item.path)} />}
            presence={presence}
            deleted={status?.tone === 'deleted'}
          />
        );
      },
    },
  ];

  const onRowKeyDown = (event: React.KeyboardEvent): void => {
    const pressed = (id: 'filesFindClear' | 'filesFind'): boolean => hotkeys(id).some((key) => matchesShortcut(event.nativeEvent, key));
    if (!pressed('filesFindClear') && !pressed('filesFind')) return;
    event.preventDefault();
    if (pressed('filesFindClear')) onLeave();
    else onFind();
  };

  return (
    <DataTable
      rows={items}
      columns={columns}
      rowKey={rowKey}
      selection={selection}
      onSelectionChange={onSelectionChange}
      onActivate={(item) => onReveal(item.path)}
      contextMenu={(selected) => contextMenu(selected.map((item) => item.path))}
      onRowKeyDown={onRowKeyDown}
      rowHeight={28}
      selectFirstRow
      label="Found items"
      hideHeader
    />
  );
}
