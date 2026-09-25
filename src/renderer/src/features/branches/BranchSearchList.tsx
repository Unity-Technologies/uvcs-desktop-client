import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { MenuEntry } from '../../lib/actions';
import { navigationTarget } from '../../lib/listNavigation';
import { isRowMenuKey, openContextMenuOf } from '../../lib/rowMenu';
import { hotkey } from '../../lib/shortcutRegistry';
import { HighlightQuery } from '../../ui/Highlight';
import { KeyHints } from '../../ui/KeyHints';
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
  const listboxId = useId();

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
    if (menu && branches[highlighted] && isRowMenuKey(event)) {
      event.preventDefault();
      openContextMenuOf(listRef.current?.querySelector<HTMLElement>(`[data-branch-index="${highlighted}"]`) ?? null);
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
          {branches.length === 0 && <div className={styles.empty}>No branches match “{query}”.</div>}
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
              const item = (
                <BranchSearchItem
                  key={row.branch.name}
                  branch={row.branch}
                  current={row.branch.name === currentBranch}
                  highlighted={row.index === highlighted}
                  id={`${listboxId}-${row.index}`}
                  role="option"
                  aria-selected={row.index === highlighted}
                  tabIndex={-1}
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
      {menu && <KeyHints hints={[{ keys: hotkey('rowActions'), label: 'actions' }]} />}
    </div>
  );
}
