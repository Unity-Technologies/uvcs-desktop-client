import { useVirtualizer } from '@tanstack/react-virtual';
import { FolderTree } from 'lucide-react';
import { useId, useRef, type KeyboardEvent } from 'react';
import type { MergeChangeKind } from '@shared/domain/merge';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge, type StatusTone } from '../../components/StatusBadge';
import { MAIN_FOCUS } from '../../lib/mainFocus';
import { ConflictStatusChip } from './ConflictStatusChip';
import type { MergeLabels } from './mergeDescription';
import { needsDecision, type MergeItem, type MergeListRow } from './mergeItems';
import { describeChange, directoryConflictStatus, fileConflictStatus, fileConflictTool } from './mergeStatus';
import styles from './MergeItemList.module.css';

const ROW_HEIGHT = 30;

const CHANGE_TONES: Record<MergeChangeKind, StatusTone> = {
  added: 'added',
  changed: 'changed',
  deleted: 'deleted',
  moved: 'moved',
  permissions: 'permissions',
};

interface MergeItemListProps {
  rows: MergeListRow[];
  labels: MergeLabels;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export function MergeItemList({ rows, labels, selectedKey, onSelect }: MergeItemListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemKeys = rows.filter((row) => row.type === 'item').map((row) => row.key);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => viewportRef.current, estimateSize: () => ROW_HEIGHT, overscan: 12 });
  const idPrefix = useId();
  const selectedIndex = rows.findIndex((row) => row.key === selectedKey);

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
    <div
      ref={viewportRef}
      className={styles.list}
      tabIndex={0}
      role="listbox"
      aria-label="Files to merge"
      aria-activedescendant={selectedIndex === -1 ? undefined : `${idPrefix}-${selectedIndex}`}
      onKeyDown={onKeyDown}
      {...MAIN_FOCUS}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index]!;
          return (
            <div
              key={row.key}
              id={`${idPrefix}-${virtualRow.index}`}
              role={row.type === 'item' ? 'option' : 'presentation'}
              aria-selected={row.type === 'item' ? row.key === selectedKey : undefined}
              className={styles.row}
              data-type={row.type}
              data-selected={row.key === selectedKey}
              style={{ top: virtualRow.start, height: ROW_HEIGHT }}
              onMouseDown={() => row.type === 'item' && onSelect(row.key)}
            >
              {row.type === 'section' ? (
                <>
                  <span className={styles.sectionLabel} data-tip={row.explanation}>
                    {row.label}
                  </span>
                  <span className={styles.count}>{row.count}</span>
                </>
              ) : (
                <ItemRow item={row.item} labels={labels} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemRow({ item, labels }: { item: MergeItem; labels: MergeLabels }) {
  switch (item.kind) {
    case 'directoryConflict':
      return (
        <>
          <span className={styles.directoryIcon} data-pending={needsDecision(item)} data-tip={item.conflict.title}>
            <FolderTree size={13} />
          </span>
          <PathLabel path={item.conflict.destination.path.replace(/^\//, '')} />
          <span className={styles.status}>
            <ConflictStatusChip
              status={directoryConflictStatus(item.resolution)}
              labels={labels}
              explanation={item.resolution ? undefined : `${item.conflict.title}: ${item.conflict.explanation}`}
              compact
            />
          </span>
        </>
      );
    case 'fileConflict':
      return (
        <>
          <StatusBadge tone="changed" title="Will be changed: both sides changed it" />
          <PathLabel path={item.state.file.path} />
          <span className={styles.status}>
            <ConflictStatusChip status={fileConflictStatus(item.state)} labels={labels} tool={fileConflictTool(item.state)} compact />
          </span>
        </>
      );
    case 'change':
      return (
        <>
          <StatusBadge tone={CHANGE_TONES[item.change.kind]} title={describeChange(item.change, labels)} />
          <PathLabel path={item.change.path.replace(/^\//, '')} oldPath={item.change.oldPath?.replace(/^\//, '')} strikethrough={item.change.kind === 'deleted'} />
        </>
      );
  }
}
