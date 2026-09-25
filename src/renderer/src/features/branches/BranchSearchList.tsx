import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { MenuEntry } from '../../lib/actions';
import { navigationTarget } from '../../lib/listNavigation';
import { HighlightQuery } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { BranchSearchItem } from './BranchSearchItem';
import { branchSearchRows, type BranchGroup } from './branchSearchRows';
import styles from './BranchSearchList.module.css';

const GROUP_HEIGHT = 28;
const BRANCH_HEIGHT = 44;

interface BranchSearchListProps {
  groups: BranchGroup[];
  onPick: (branch: Branch) => void;
  /** Marks a branch, e.g. the one the workspace is on. */
  currentBranch?: string;
  placeholder?: string;
  /** The context menu of a row. */
  menu?: (branch: Branch) => MenuEntry[];
  /** Next to the filter field, e.g. a "New branch" button. */
  action?: ReactNode;
}

/** A searchable, keyboard-driven list of branches in titled groups. Virtualized: repositories can have thousands of branches. */
export function BranchSearchList({ groups, onPick, currentBranch, placeholder = 'Find a branch', menu, action }: BranchSearchListProps) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const movedByKeyboard = useRef(false);

  const { rows, branches } = useMemo(() => branchSearchRows(groups, query), [groups, query]);
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
    if (menu && (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))) {
      event.preventDefault();
      openRowMenu(highlighted);
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

  /** The context menu of a row from the keyboard, opened where a right click on it would. */
  const openRowMenu = (index: number): void => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-branch-index="${index}"]`);
    if (!row) return;
    const bounds = row.getBoundingClientRect();
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: bounds.left + 24, clientY: bounds.bottom - 4 }));
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
          {branches.length === 0 && <div className={styles.empty}>No branches match “{query}”.</div>}
          <div className={styles.rows} style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]!;
              const position = {
                top: virtualRow.start,
                height: virtualRow.size,
              };
              if (row.type === 'group') {
                return (
                  <div key={`group:${row.title}`} className={styles.groupTitle} style={position}>
                    {row.title}
                  </div>
                );
              }
              const item = (
                <BranchSearchItem
                  key={row.branch.name}
                  branch={row.branch}
                  current={row.branch.name === currentBranch}
                  highlighted={row.index === highlighted}
                  data-branch-index={row.index}
                  style={position}
                  onMouseEnter={() => setHighlighted(row.index)}
                  onClick={() => onPick(row.branch)}
                />
              );
              return menu ? (
                <ActionContextMenu
                  key={row.branch.name}
                  entries={() => menu(row.branch)}
                  // Back to the filter, so typing and the arrow keys carry on.
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    inputRef.current?.focus();
                  }}
                >
                  {item}
                </ActionContextMenu>
              ) : (
                item
              );
            })}
          </div>
        </div>
      </HighlightQuery>
    </div>
  );
}
