import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import type { RepositorySummary } from '@shared/domain/repository';
import { keepRendered } from '../../lib/keepRendered';
import { HighlightQuery } from '../../ui/Highlight';
import { RepositoryRow } from './RepositoryRow';
import { repositoryRowKey, repositoryRowKeyTarget, type RepositoryListRow } from './repositoryListRows';
import { WorkspaceRow } from './WorkspaceRow';
import styles from './Home.module.css';

/** What takes the focus in a row: a repository's or a workspace's main button. */
const ROW_FOCUS = '[data-roving-item], [data-workspace-row]';

/** Close to each row's height, so the scroll bar barely moves as rows are measured. */
const ESTIMATED_HEIGHT: Record<RepositoryListRow['kind'], number> = { repository: 50, workspace: 47, newWorkspace: 34 };

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
  const [focused, setFocused] = useState<number | null>(null);
  const focusRequested = useRef(false);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => ESTIMATED_HEIGHT[rows[index]!.kind],
    getItemKey: (index) => repositoryRowKey(rows[index]!),
    overscan: 8,
    rangeExtractor: (range) => keepRendered(defaultRangeExtractor(range), focused, rows.length),
  });

  const focusRow = (index: number): void => {
    focusRequested.current = true;
    setFocused(index);
    virtualizer.scrollToIndex(index);
  };

  // A row asked for by the keys may render only after the scroll: it takes the focus once it's there.
  useLayoutEffect(() => {
    if (!focusRequested.current || focused === null) return;
    const row = listRef.current?.querySelector(`[data-index="${focused}"]`)?.querySelector<HTMLElement>(ROW_FOCUS);
    if (!row) return;
    focusRequested.current = false;
    row.focus({ preventScroll: true });
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
    // Keys pressed in a row's menu (a portal) bubble here too: they belong to the menu.
    if (!event.currentTarget.contains(event.target as Node) || event.metaKey || event.ctrlKey || event.altKey) return;
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
    if (index !== null && index !== focused) setFocused(index);
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
        <div className={styles.repositoryRows} style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]!;
            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                data-kind={row.kind}
                className={styles.repositorySlot}
                style={{ transform: `translateY(${item.start}px)` }}
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
