import { useVirtualizer } from '@tanstack/react-virtual';
import { GitCommitVertical } from 'lucide-react';
import { useId, useMemo, useRef, type KeyboardEvent } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry, DiffStatus } from '@shared/domain/diff';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge, type StatusTone } from '../../components/StatusBadge';
import { navigationTarget } from '../../lib/listNavigation';
import { firstLine } from '../../lib/text';
import { MAIN_FOCUS } from '../../lib/mainFocus';
import { Avatar } from '../../ui/Avatar';
import { RelativeTime } from '../../ui/RelativeTime';
import { incomingRows, selectionKey, type IncomingRow, type IncomingSelection } from './incomingRows';
import styles from './IncomingList.module.css';

const TONES: Record<DiffStatus, StatusTone> = { added: 'added', changed: 'changed', deleted: 'deleted', moved: 'moved' };
/** Estimates until each row is measured: a section header, a changeset (two lines) and a file. */
const ESTIMATED_HEIGHTS: Record<IncomingRow['type'], number> = { section: 29, changeset: 49, file: 28 };

interface IncomingListProps {
  changesets: Changeset[];
  files: DiffEntry[];
  /** Paths that changed locally too; resolved ones are no longer pending. */
  conflictPaths: ReadonlySet<string>;
  pendingConflictPaths: ReadonlySet<string>;
  /** Paths changed locally that the branch deleted or moved (by their old path): they block the update. */
  blockedPaths: ReadonlySet<string>;
  /** The merge tool each file is open in, while it is. */
  openToolByPath: ReadonlyMap<string, string>;
  selection: IncomingSelection | null;
  onSelect: (selection: IncomingSelection) => void;
}

/** Hundreds of changesets and thousands of files: only the rows in view render. */
export function IncomingList({ changesets, files, conflictPaths, pendingConflictPaths, blockedPaths, openToolByPath, selection, onSelect }: IncomingListProps) {
  const { rows, entries, rowIndexOf } = useMemo(() => incomingRows(changesets, files, conflictPaths, blockedPaths), [changesets, files, conflictPaths, blockedPaths]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) => ESTIMATED_HEIGHTS[rows[index]!.type],
    getItemKey: (index) => rows[index]!.key,
    overscan: 12,
  });
  const idPrefix = useId();
  const selectedKey = selection && selectionKey(selection);
  const selectedRow = selectedKey === null ? undefined : rows[rowIndexOf.get(selectedKey) ?? -1];
  const selectedIndex = selectedRow && selectedRow.type !== 'section' ? selectedRow.entryIndex : -1;
  const isBlocking = (file: DiffEntry): boolean => blockedPaths.has(file.oldPath ?? file.path);

  const onKeyDown = (event: KeyboardEvent): void => {
    const ends: Record<string, number> = { Home: 0, End: entries.length - 1 };
    const target = ends[event.key] ?? navigationTarget(event.key, selectedIndex, entries.length);
    if (target === null || target === undefined || entries.length === 0) return;
    event.preventDefault();
    const entry = entries[target]!;
    onSelect(entry.selection);
    // The first one shows its section's header too.
    virtualizer.scrollToIndex(target === 0 ? 0 : rowIndexOf.get(entry.key)!);
  };

  const fileRow = (file: DiffEntry, key: string, entryIndex: number) => (
    <button
      id={`${idPrefix}-${entryIndex}`}
      role="option"
      aria-selected={key === selectedKey}
      tabIndex={-1}
      className={styles.row}
      data-selected={key === selectedKey}
      onClick={() => onSelect({ kind: 'file', path: file.path })}
    >
      {openToolByPath.has(file.path) ? (
        <StatusBadge tone="conflict" title={`Open in ${openToolByPath.get(file.path)}…`} letter="…" />
      ) : isBlocking(file) ? (
        <StatusBadge tone="conflict" title={`Changed locally, ${file.status === 'deleted' ? 'deleted' : 'moved'} on the branch: shelve it to update`} />
      ) : conflictPaths.has(file.path) ? (
        <StatusBadge
          tone={pendingConflictPaths.has(file.path) ? 'conflict' : 'added'}
          title={pendingConflictPaths.has(file.path) ? 'Changed locally too: needs merging' : 'Merged'}
          letter={pendingConflictPaths.has(file.path) ? '!' : '✓'}
        />
      ) : (
        <StatusBadge tone={TONES[file.status]} title={file.status} />
      )}
      <PathLabel path={file.path} oldPath={file.oldPath} strikethrough={file.status === 'deleted'} />
    </button>
  );

  const changesetRow = (changeset: Changeset, key: string, entryIndex: number) => (
    <button
      id={`${idPrefix}-${entryIndex}`}
      role="option"
      aria-selected={key === selectedKey}
      tabIndex={-1}
      className={styles.changeset}
      data-selected={key === selectedKey}
      onClick={() => onSelect({ kind: 'changeset', id: changeset.id })}
    >
      <GitCommitVertical size={14} className={styles.changesetIcon} />
      <span className={styles.changesetText}>
        <span className={styles.comment}>{firstLine(changeset.comment) || 'No comment'}</span>
        <span className={styles.meta}>
          <Avatar user={changeset.owner} size={14} />
          cs:{changeset.id} · <RelativeTime date={changeset.date} />
        </span>
      </span>
    </button>
  );

  return (
    <div
      ref={viewportRef}
      className={styles.list}
      tabIndex={0}
      role="listbox"
      aria-label="Incoming changes"
      aria-activedescendant={selectedIndex === -1 ? undefined : `${idPrefix}-${selectedIndex}`}
      onKeyDown={onKeyDown}
      {...MAIN_FOCUS}
    >
      <div className={styles.rows} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]!;
          return (
            <div
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              role="presentation"
              className={styles.slot}
              data-section-start={row.type === 'section' && item.index > 0}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {row.type === 'section' ? (
                <div className={styles.sectionHeader}>
                  <span>{row.label}</span>
                  <span className={styles.count}>{row.count}</span>
                </div>
              ) : row.type === 'file' ? (
                fileRow(row.file, row.key, row.entryIndex)
              ) : (
                changesetRow(row.changeset, row.key, row.entryIndex)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
