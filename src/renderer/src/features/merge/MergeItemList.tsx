import { useVirtualizer } from '@tanstack/react-virtual';
import { FolderTree } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import type { MergeChangeKind } from '@shared/domain/merge';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge, type StatusTone } from '../../components/StatusBadge';
import { needsDecision, type MergeItem, type MergeListRow } from './mergeItems';
import styles from './MergeItemList.module.css';

const ROW_HEIGHT = 30;

const CHANGE_TONES: Record<MergeChangeKind, StatusTone> = {
  added: 'added',
  changed: 'changed',
  deleted: 'deleted',
  moved: 'moved',
  permissions: 'muted',
};

interface MergeItemListProps {
  rows: MergeListRow[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function MergeItemList({ rows, selectedKey, onSelect }: MergeItemListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemKeys = rows.filter((row) => row.type === 'item').map((row) => row.key);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => viewportRef.current, estimateSize: () => ROW_HEIGHT, overscan: 12 });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const current = selectedKey ? itemKeys.indexOf(selectedKey) : -1;
    const next = itemKeys[Math.min(itemKeys.length - 1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)))];
    if (!next) return;
    onSelect(next);
    virtualizer.scrollToIndex(rows.findIndex((row) => row.key === next));
  };

  return (
    <div ref={viewportRef} className={styles.list} tabIndex={0} onKeyDown={onKeyDown}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]!;
          return (
            <div
              key={row.key}
              className={styles.row}
              data-type={row.type}
              data-selected={row.key === selectedKey}
              style={{ top: virtualRow.start, height: ROW_HEIGHT }}
              onMouseDown={() => row.type === 'item' && onSelect(row.key)}
            >
              {row.type === 'section' ? (
                <>
                  <span className={styles.sectionLabel}>{row.label}</span>
                  <span className={styles.count}>{row.count}</span>
                </>
              ) : (
                <ItemRow item={row.item} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: MergeItem }) {
  const pending = needsDecision(item);

  switch (item.kind) {
    case 'directoryConflict':
      return (
        <>
          <span className={styles.directoryIcon} data-pending={pending}>
            <FolderTree size={13} />
          </span>
          <PathLabel path={item.conflict.destination.path.replace(/^\//, '')} />
          <span className={styles.tag} data-pending={pending}>
            {pending ? item.conflict.title : 'Decided'}
          </span>
        </>
      );
    case 'fileConflict': {
      const { state } = item;
      return (
        <>
          <StatusBadge tone={pending ? 'conflict' : 'added'} title={pending ? 'Needs a decision' : 'Resolved'} letter={pending ? '!' : '✓'} />
          <PathLabel path={state.file.path} />
          <span className={styles.tag} data-pending={pending}>
            {state.status !== 'ready' ? '…' : state.mergedAutomatically ? 'Auto-merged' : pending ? 'Needs you' : 'Resolved'}
          </span>
        </>
      );
    }
    case 'change':
      return (
        <>
          <StatusBadge tone={CHANGE_TONES[item.change.kind]} title={item.change.kind} />
          <PathLabel path={item.change.path.replace(/^\//, '')} oldPath={item.change.oldPath?.replace(/^\//, '')} strikethrough={item.change.kind === 'deleted'} />
        </>
      );
  }
}
