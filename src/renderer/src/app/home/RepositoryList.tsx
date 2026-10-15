import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { keepRendered } from '../../lib/keepRendered';
import { HighlightQuery } from '../../ui/Highlight';
import { RepositoryRow } from './RepositoryRow';
import { movesBetweenRows, repositoryRowIndex, repositoryRowKey, repositoryRowKeyTarget, type RepositoryListRow } from './repositoryListRows';
import { WorkspaceRow } from './WorkspaceRow';
import styles from './Home.module.css';

/** What takes the focus in a row: a repository's or a workspace's main button. */
const ROW_FOCUS = '[data-roving-item], [data-workspace-row]';

/** Close to each row's height, so the scroll bar barely moves as rows are measured. */
const ESTIMATED_HEIGHT: Record<RepositoryListRow['kind'], number> = { repository: 50, workspace: 47, newWorkspace: 34 };

/** Pixels: `.list`'s padding, kept clear above and below a row the keys scroll to, so its focus ring shows whole. */
const LIST_PADDING = 8;

export interface RepositoryListHandle {
  /** ↓ from the search field: the first row takes the focus. False when there is none. */
  focusFirst: () => boolean;
}

interface RepositoryListProps {
  rows: RepositoryListRow[];
  /** The filter the repositories' names are marked by. */
  query: string;
  /** Above the rows: the skeleton while loading, the error, the empty state. */
  placeholder?: ReactNode;
  onToggle: (repository: RepositorySummary) => void;
  onOpen: (path: string) => void;
  onCreateWorkspace: (repository: RepositorySummary) => void;
  /** ↑ on the first row: back to the search field. */
  onLeaveTop: () => void;
}

/**
 * The repositories of a server, each expanding into its workspaces. A server holds thousands: only the rows in view
 * render. ↑↓, Page Up / Down, Home and End move the focus between repositories and workspaces (`repositoryRowKeyTarget`);
 * the row holding the focus stays rendered while scrolled away (`keepRendered`).
 */
export const RepositoryList = forwardRef<RepositoryListHandle, RepositoryListProps>(function RepositoryList(
  { rows, query, placeholder, onToggle, onOpen, onCreateWorkspace, onLeaveTop },
  ref,
) {
  const listRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  // The row holding the focus, by its key: the filter or an expanding repository moves it, the focus stays on it.
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  // A row the keys moved to that wasn't rendered yet: it takes the focus once the scroll renders it.
  const pendingFocus = useRef<string | null>(null);
  // Where the rows start in the scrolled content: below the list's padding and whatever shows above them.
  const [scrollMargin, setScrollMargin] = useState(0);
  const focusedIndex = focusedKey === null ? null : repositoryRowIndex(rows, focusedKey);
  const estimateSize = useCallback((index: number) => ESTIMATED_HEIGHT[rows[index]!.kind], [rows]);
  const getItemKey = useCallback((index: number) => repositoryRowKey(rows[index]!), [rows]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize,
    getItemKey,
    overscan: 8,
    scrollMargin,
    scrollPaddingStart: LIST_PADDING,
    scrollPaddingEnd: LIST_PADDING,
    rangeExtractor: (range) => keepRendered(defaultRangeExtractor(range), focusedIndex, rows.length),
  });

  const focusableAt = (index: number): HTMLElement | null =>
    listRef.current?.querySelector(`[data-index="${index}"]`)?.querySelector<HTMLElement>(ROW_FOCUS) ?? null;

  // Rendered already (the overscan holds the rows next to the one focused), it takes the focus at once.
  const focusRow = (index: number): void => {
    const key = repositoryRowKey(rows[index]!);
    virtualizer.scrollToIndex(index);
    setFocusedKey(key);
    const row = focusableAt(index);
    pendingFocus.current = row ? null : key;
    row?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    const top = rowsRef.current && listRef.current ? rowsRef.current.getBoundingClientRect().top - listRef.current.getBoundingClientRect().top + listRef.current.scrollTop : 0;
    if (Math.round(top) !== scrollMargin) setScrollMargin(Math.round(top));
    if (pendingFocus.current === null) return;
    const index = repositoryRowIndex(rows, pendingFocus.current);
    const row = index === -1 ? null : focusableAt(index);
    if (index !== -1 && !row) return;
    pendingFocus.current = null;
    row?.focus({ preventScroll: true });
  });

  useImperativeHandle(ref, () => ({
    focusFirst: () => {
      if (rows.length === 0) return false;
      focusRow(0);
      return true;
    },
  }));

  const rowIndexOf = (target: EventTarget): number | null => {
    const index = (target as HTMLElement).closest?.('[data-index]')?.getAttribute('data-index');
    return index === null || index === undefined ? null : Number(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // Keys on a row's other buttons (the ⋯ menu's ↓ opens it) or in a menu (a portal, whose keys bubble here too) are theirs.
    const onRowButton = Boolean((event.target as Element).matches?.(ROW_FOCUS));
    if (!movesBetweenRows({ defaultPrevented: event.defaultPrevented, onRowButton, withModifiers: event.metaKey || event.ctrlKey || event.altKey })) return;
    const current = rowIndexOf(event.target);
    if (current === null) return;
    const target = repositoryRowKeyTarget(rows, current, event.key);
    if (target === null) return;
    event.preventDefault();
    if (target === 'leaveTop') onLeaveTop();
    else focusRow(target);
  };

  // A click or Tab moves the focus too: that row is the one kept rendered.
  const onFocus = (event: FocusEvent<HTMLDivElement>): void => {
    const index = rowIndexOf(event.target);
    const row = index === null ? undefined : rows[index];
    if (row) setFocusedKey(repositoryRowKey(row));
  };

  const rowContent = (row: RepositoryListRow): ReactNode => {
    switch (row.kind) {
      case 'repository':
        return (
          <RepositoryRow
            repository={row.repository}
            workspaces={row.workspaces}
            expanded={row.expanded}
            onToggle={() => onToggle(row.repository)}
            onOpen={onOpen}
            onCreateWorkspace={onCreateWorkspace}
          />
        );
      case 'workspace':
        return (
          // The filter matches repository names only, not their workspaces.
          <HighlightQuery query="">
            <div className={styles.nested}>
              <WorkspaceRow workspace={row.workspace} repository={row.repository.spec} onOpen={onOpen} compact />
            </div>
          </HighlightQuery>
        );
      case 'newWorkspace':
        return (
          <div className={styles.nested}>
            <button className={styles.nestedAction} onClick={() => onCreateWorkspace(row.repository)}>
              + New workspace for {row.repository.name}
            </button>
          </div>
        );
    }
  };

  return (
    <div ref={listRef} className={styles.list} onKeyDown={onKeyDown} onFocus={onFocus}>
      {placeholder}
      <HighlightQuery query={query}>
        <div ref={rowsRef} className={styles.repositoryRows} style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]!;
            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                data-kind={row.kind}
                className={styles.repositorySlot}
                style={{ transform: `translateY(${item.start - scrollMargin}px)` }}
              >
                {rowContent(row)}
              </div>
            );
          })}
        </div>
      </HighlightQuery>
    </div>
  );
});
