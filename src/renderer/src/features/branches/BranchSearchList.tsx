import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { Place } from '@shared/domain/place';
import type { MenuEntry } from '../../lib/actions';
import { navigationTarget } from '../../lib/listNavigation';
import { isRowMenuKey, showsRowActions } from '../../lib/rowMenu';
import { hotkey } from '../../lib/shortcutRegistry';
import { HighlightQuery } from '../../ui/Highlight';
import { KeyHints } from '../../ui/KeyHints';
import { RowActionsButton } from '../../ui/menu/RowActionsButton';
import { ListSkeleton } from '../../ui/Skeleton';
import { BranchReviewChip } from '../codeReviews/BranchReviewChip';
import { BranchSearchItem } from './BranchSearchItem';
import { branchSearchEmptyText, branchSearchRows, type BranchesRead, type BranchGroup } from './branchSearchRows';
import styles from './BranchSearchList.module.css';

const GROUP_HEIGHT = 28;
const BRANCH_HEIGHT = 44;
/** Placeholder rows while the branches are read: a short list's height, so the popup doesn't open small and grow. */
const LOADING_ROWS = 6;

interface BranchSearchListProps {
  groups: BranchGroup[];
  onPick: (branch: Branch) => void;
  /** Marks a branch, e.g. the one the workspace is on. */
  currentBranch?: string;
  placeholder?: string;
  /** A row's actions: its "…", a right click on it, and Tab on the highlighted one open them. */
  menu?: (branch: Branch) => MenuEntry[];
  /** Next to the filter field, e.g. a "New branch" button. */
  action?: ReactNode;
  /**
   * Each row drawn shows its branch's review chip as the Branches view does (`BranchReviewChip`): whose branches they
   * are, and how to close what holds the list (a popup, a dialog) before a review opens from its chip or card. Left out
   * for another repository's branches (an xlink's), whose reviews don't matter to the pick.
   */
  reviews?: { place: Place; leave: () => void };
  /** Where the branches stand (`branchesRead`): the list keeps its frame while they're read, and says when they can't be. */
  read?: BranchesRead;
}

/** A searchable, keyboard-driven list of branches in titled groups. Virtualized: repositories can have thousands of branches. */
export function BranchSearchList({ groups, onPick, currentBranch, placeholder = 'Find a branch', menu, reviews, action, read = 'read' }: BranchSearchListProps) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  /** The branch whose actions are open. */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const movedByKeyboard = useRef(false);
  const listboxId = useId();

  const { rows, branches } = useMemo(() => branchSearchRows(groups, query), [groups, query]);
  const emptyText = branchSearchEmptyText(query, read);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) => (rows[index]!.type === 'group' ? GROUP_HEIGHT : BRANCH_HEIGHT),
    overscan: 8,
  });

  useEffect(() => {
    if (!movedByKeyboard.current) return;
    movedByKeyboard.current = false;
    const rowIndex = rows.findIndex((row) => row.type === 'branch' && row.index === highlighted);
    // The first branch brings its group title into view too.
    if (rowIndex !== -1) virtualizer.scrollToIndex(highlighted === 0 ? 0 : rowIndex);
  }, [highlighted, rows, virtualizer]);

  const onKeyDown = (event: KeyboardEvent): void => {
    // Keys pressed in a row's context menu (a portal) bubble here too: they belong to the menu.
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (menu && branches[highlighted] && isRowMenuKey(event)) {
      event.preventDefault();
      setMenuFor(branches[highlighted].name);
      return;
    }
    const target = navigationTarget(event.key, highlighted, branches.length);
    if (target !== null) {
      event.preventDefault();
      movedByKeyboard.current = true;
      setHighlighted(target);
    } else if (event.key === 'Enter' && branches[highlighted]) {
      event.preventDefault();
      onPick(branches[highlighted]);
    }
  };

  return (
    <div className={styles.container} onKeyDown={onKeyDown}>
      <div className={styles.search}>
        <Search size={14} className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          placeholder={placeholder}
          autoFocus
          spellCheck={false}
          role="combobox"
          aria-label={placeholder}
          aria-expanded
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={branches[highlighted] ? `${listboxId}-${highlighted}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
            listRef.current?.scrollTo({ top: 0 });
          }}
        />
        {action}
      </div>
      <HighlightQuery query={query}>
        <div ref={listRef} className={styles.list}>
          {read === 'loading' && (
            // Placeholder rows at the branches' own height while they're read, so the list opens at the size it keeps.
            <div className={styles.loading} style={{ height: BRANCH_HEIGHT * LOADING_ROWS }}>
              <ListSkeleton rowHeight={BRANCH_HEIGHT} />
            </div>
          )}
          {branches.length === 0 && emptyText && <div className={styles.empty}>{emptyText}</div>}
          <div id={listboxId} role="listbox" aria-label="Branches" className={styles.rows} style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]!;
              const position = {
                top: virtualRow.start,
                height: virtualRow.size,
              };
              if (row.type === 'group') {
                return (
                  <div key={`group:${row.title}`} role="presentation" className={styles.groupTitle} style={position}>
                    {row.title}
                  </div>
                );
              }
              const menuOpen = row.branch.name === menuFor;
              return (
                <div
                  key={row.branch.name}
                  id={`${listboxId}-${row.index}`}
                  role="option"
                  aria-selected={row.index === highlighted}
                  className={styles.row}
                  data-highlighted={row.index === highlighted}
                  data-branch-index={row.index}
                  style={position}
                  onMouseEnter={() => setHighlighted(row.index)}
                  onContextMenu={
                    menu &&
                    ((event) => {
                      event.preventDefault();
                      setHighlighted(row.index);
                      setMenuFor(row.branch.name);
                    })
                  }
                >
                  <BranchSearchItem
                    branch={row.branch}
                    current={row.branch.name === currentBranch}
                    badge={reviews && <BranchReviewChip place={reviews.place} leave={reviews.leave} branchId={row.branch.id} />}
                    tabIndex={-1}
                    onClick={() => onPick(row.branch)}
                  />
                  {menu && showsRowActions({ highlighted: row.index === highlighted, menuOpen }) && (
                    <RowActionsButton
                      entries={() => menu(row.branch)}
                      open={menuOpen}
                      onOpenChange={(open) => setMenuFor(open ? row.branch.name : null)}
                      // Back to the filter, so typing and the arrow keys carry on.
                      onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        inputRef.current?.focus();
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </HighlightQuery>
      {menu && <KeyHints hints={[{ keys: hotkey('rowActions'), label: 'actions' }]} />}
    </div>
  );
}
