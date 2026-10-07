import { useVirtualizer } from '@tanstack/react-virtual';
import { GitCommitVertical } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry } from '@shared/domain/diff';
import { INCOMING_CHANGESETS_PAGE } from '@shared/domain/incoming';
import { ItemPathRow } from '../../components/ItemPathRow';
import { navigationTarget } from '../../lib/listNavigation';
import { firstLine, formatCountAtLeast } from '../../lib/text';
import { MAIN_FOCUS } from '../../lib/mainFocus';
import { Avatar } from '../../ui/Avatar';
import { RelativeTime } from '../../ui/RelativeTime';
import { Spinner } from '../../ui/Spinner';
import { diffEntryStatus } from '../diff/diffEntrySources';
import { ConflictStatusChip } from '../merge/ConflictStatusChip';
import type { ConflictStatus } from '../merge/mergeStatus';
import { UPDATE_LABELS } from './updateConflictFiles';
import { incomingRows, MORE_CHANGESETS_KEY, selectionKey, type IncomingRow, type IncomingSelection } from './incomingRows';
import styles from './IncomingList.module.css';

/** Estimates until each row is measured: a section header, a changeset (two lines), "Show more" and a file. */
const ESTIMATED_HEIGHTS: Record<IncomingRow['type'], number> = { section: 29, changeset: 49, moreChangesets: 28, file: 28 };

interface IncomingListProps {
  changesets: Changeset[];
  files: DiffEntry[];
  /** Paths that changed locally too. */
  conflictPaths: ReadonlySet<string>;
  /** Where each of those stands, once its versions are read, as on the merge page; the merge tool it's open in or was resolved in. */
  conflictStates: ReadonlyMap<string, { status: ConflictStatus; tool?: string }>;
  /** Paths changed locally that the branch deleted or moved (by their old path): they block the update. */
  blockedPaths: ReadonlySet<string>;
  selection: IncomingSelection | null;
  onSelect: (selection: IncomingSelection) => void;
  /** Older changesets remain to be read: the changesets end with "Show more", reading them while `loading`. */
  olderChangesets: { loading: boolean; onShowMore: () => void } | null;
}

/** Hundreds of changesets and thousands of files: only the rows in view render. */
export function IncomingList({ changesets, files, conflictPaths, conflictStates, blockedPaths, selection, onSelect, olderChangesets }: IncomingListProps) {
  const hasOlder = olderChangesets !== null;
  const { rows, entries, rowIndexOf } = useMemo(
    () => incomingRows(changesets, files, conflictPaths, blockedPaths, hasOlder),
    [changesets, files, conflictPaths, blockedPaths, hasOlder],
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) => ESTIMATED_HEIGHTS[rows[index]!.type],
    getItemKey: (index) => rows[index]!.key,
    overscan: 12,
  });
  const idPrefix = useId();
  // The arrows can rest on "Show more", which selects nothing: Enter reads the next page there, and it stays put.
  const [onShowMore, setOnShowMore] = useState(false);
  const activeKey = onShowMore && rowIndexOf.has(MORE_CHANGESETS_KEY) ? MORE_CHANGESETS_KEY : selection && selectionKey(selection);
  const selectedKey = selection && selectionKey(selection);
  const activeRow = activeKey === null ? undefined : rows[rowIndexOf.get(activeKey) ?? -1];
  const selectedIndex = activeRow && 'entryIndex' in activeRow ? activeRow.entryIndex : -1;
  const restingOnShowMore = activeKey === MORE_CHANGESETS_KEY;
  // The selection stays while the arrows rest on "Show more", quieter, as the pane beside the list still shows it.
  const selectedLook = (key: string): 'true' | 'quiet' | 'false' => (key !== selectedKey ? 'false' : restingOnShowMore ? 'quiet' : 'true');
  const select = (next: IncomingSelection): void => {
    setOnShowMore(false);
    onSelect(next);
  };

  // Enter on "Show more": once the page lands, the arrows go on from its first changeset, scrolled into view.
  const [landingAt, setLandingAt] = useState<number | null>(null);
  useEffect(() => {
    if (landingAt === null || changesets.length <= landingAt) return;
    const first = changesets[landingAt]!;
    setLandingAt(null);
    select({ kind: 'changeset', id: first.id });
    virtualizer.scrollToIndex(rowIndexOf.get(selectionKey({ kind: 'changeset', id: first.id }))!);
    // Only the page landing moves the arrows: not the selection, the rows or the virtualizer changing.
  }, [changesets, landingAt]);
  const isBlocking = (file: DiffEntry): boolean => blockedPaths.has(file.oldPath ?? file.path);

  const onKeyDown = (event: KeyboardEvent): void => {
    // ⌥↑ ⌥↓ move through the changes of the diff beside the list (`useChangeNavigation`).
    if (event.altKey) return;
    if (event.key === 'Enter' && activeKey === MORE_CHANGESETS_KEY) {
      event.preventDefault();
      if (olderChangesets && !olderChangesets.loading) {
        setLandingAt(changesets.length);
        olderChangesets.onShowMore();
      }
      return;
    }
    const ends: Record<string, number> = { Home: 0, End: entries.length - 1 };
    const target = ends[event.key] ?? navigationTarget(event.key, selectedIndex, entries.length);
    if (target === null || target === undefined || entries.length === 0) return;
    event.preventDefault();
    const entry = entries[target]!;
    if (entry.selection) select(entry.selection);
    else setOnShowMore(true);
    // The first one shows its section's header too.
    virtualizer.scrollToIndex(target === 0 ? 0 : rowIndexOf.get(entry.key)!);
  };

  // Where a file changed on both sides stands, as on the merge page: the letter stays what the branch did to it.
  const conflictMark = (file: DiffEntry) => {
    if (isBlocking(file)) {
      const explanation = `Changed locally, ${file.status === 'deleted' ? 'deleted' : 'moved'} on the branch: shelve it to update`;
      return <ConflictStatusChip status="needsDecision" labels={UPDATE_LABELS} explanation={explanation} compact />;
    }
    if (!conflictPaths.has(file.path)) return null;
    const conflict = conflictStates.get(file.path);
    return <ConflictStatusChip status={conflict?.status ?? 'reading'} labels={UPDATE_LABELS} tool={conflict?.tool} compact />;
  };

  const fileRow = (file: DiffEntry, key: string, entryIndex: number) => (
    <button
      id={`${idPrefix}-${entryIndex}`}
      role="option"
      aria-selected={key === selectedKey}
      tabIndex={-1}
      className={styles.row}
      data-selected={selectedLook(key)}
      onClick={() => select({ kind: 'file', path: file.path })}
    >
      <ItemPathRow
        path={file.path}
        itemType={file.itemType}
        oldPath={file.oldPath}
        status={diffEntryStatus(file)}
        extras={conflictMark(file)}
      />
    </button>
  );

  const changesetRow = (changeset: Changeset, key: string, entryIndex: number) => (
    <button
      id={`${idPrefix}-${entryIndex}`}
      role="option"
      aria-selected={key === selectedKey}
      tabIndex={-1}
      className={styles.changeset}
      data-selected={selectedLook(key)}
      onClick={() => select({ kind: 'changeset', id: changeset.id })}
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
                  <span className={styles.count}>{formatCountAtLeast(row.count, row.countCapped)}</span>
                </div>
              ) : row.type === 'moreChangesets' ? (
                <button
                  id={`${idPrefix}-${row.entryIndex}`}
                  type="button"
                  role="option"
                  aria-selected={activeKey === row.key}
                  tabIndex={-1}
                  className={styles.showMore}
                  data-selected={activeKey === row.key}
                  disabled={olderChangesets?.loading}
                  onClick={olderChangesets?.onShowMore}
                >
                  {olderChangesets?.loading && <Spinner size={12} />}
                  Show {INCOMING_CHANGESETS_PAGE} more
                </button>
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
