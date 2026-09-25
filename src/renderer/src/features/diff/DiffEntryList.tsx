import { useMemo, useState } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import type { MenuEntry } from '../../lib/actions';
import type { SelectionState } from '../../lib/selection';
import { SearchField } from '../../ui/SearchField';
import { DataTable, type Column } from '../../ui/table/DataTable';
import { describeDiffEntry, diffEntryTone, isMovedAndChanged } from './diffEntrySources';
import styles from './DiffEntryList.module.css';

interface DiffEntryListProps {
  entries: DiffEntry[];
  selection: SelectionState;
  onSelectionChange: (selection: SelectionState) => void;
  contextMenu: (selected: DiffEntry[]) => MenuEntry[];
}

const COLUMNS: Column<DiffEntry>[] = [
  {
    id: 'status',
    header: '',
    width: 36,
    render: (entry) => <StatusBadge tone={diffEntryTone(entry)} title={describeDiffEntry(entry)} />,
  },
  {
    id: 'path',
    header: 'File',
    render: (entry) => (
      <>
        <PathLabel path={entry.path} oldPath={entry.oldPath} strikethrough={entry.status === 'deleted'} />
        {isMovedAndChanged(entry) && <span className={styles.tag}>modified</span>}
      </>
    ),
  },
];

export const diffEntryKey = (entry: DiffEntry): string => entry.path;

export function DiffEntryList({ entries, selection, onSelectionChange, contextMenu }: DiffEntryListProps) {
  const [filter, setFilter] = useState('');
  const visible = useMemo(() => entries.filter((entry) => entry.path.toLowerCase().includes(filter.toLowerCase())), [entries, filter]);

  return (
    <div className={styles.list}>
      <div className={styles.toolbar}>
        <SearchField value={filter} onChange={setFilter} placeholder={`Filter ${entries.length} files`} width="100%" />
      </div>
      <DataTable
        rows={visible}
        columns={COLUMNS}
        rowKey={diffEntryKey}
        selection={selection}
        onSelectionChange={onSelectionChange}
        contextMenu={contextMenu}
        rowHeight={28}
      />
    </div>
  );
}
