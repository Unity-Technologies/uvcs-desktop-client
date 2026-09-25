import { GitBranch, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Branch } from '@shared/domain/branch';
import type { MenuEntry } from '../../lib/actions';
import { navigationTarget } from '../../lib/listNavigation';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import styles from './BranchSearchList.module.css';

export interface BranchGroup {
  title: string;
  branches: Branch[];
}

interface BranchSearchListProps {
  groups: BranchGroup[];
  onPick: (branch: Branch) => void;
  /** Marks a branch, e.g. the one the workspace is on. */
  currentBranch?: string;
  placeholder?: string;
  /** The context menu of a row. */
  menu?: (branch: Branch) => MenuEntry[];
  /** Rendered below the list, e.g. a "New branch" button. */
  footer?: ReactNode;
}

/** A searchable, keyboard-driven list of branches in titled groups. */
export function BranchSearchList({ groups, onPick, currentBranch, placeholder = 'Find a branch', menu, footer }: BranchSearchListProps) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const movedByKeyboard = useRef(false);

  const visibleGroups = useMemo(() => filterGroups(groups, query), [groups, query]);
  const flat = visibleGroups.flatMap((group) => group.branches);

  useEffect(() => {
    if (!movedByKeyboard.current) return;
    movedByKeyboard.current = false;
    listRef.current?.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = navigationTarget(event.key, highlighted, flat.length);
    if (target !== null) {
      event.preventDefault();
      movedByKeyboard.current = true;
      setHighlighted(target);
    } else if (event.key === 'Enter' && flat[highlighted]) {
      event.preventDefault();
      onPick(flat[highlighted]);
    }
  };

  const groupOffsets = visibleGroups.map((_, index) =>
    visibleGroups.slice(0, index).reduce((count, group) => count + group.branches.length, 0),
  );

  return (
    <div className={styles.container} onKeyDown={onKeyDown}>
      <div className={styles.search}>
        <Search size={14} className={styles.searchIcon} />
        <input
          className={styles.input}
          value={query}
          placeholder={placeholder}
          autoFocus
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
          }}
        />
      </div>
      <HighlightQuery query={query}>
        <div ref={listRef} className={styles.list}>
          {flat.length === 0 && <div className={styles.empty}>No branches match “{query}”.</div>}
          {visibleGroups.map((group, groupIndex) => (
            <div key={group.title}>
              <div className={styles.groupTitle}>{group.title}</div>
              {group.branches.map((branch, branchIndex) => {
                const index = groupOffsets[groupIndex]! + branchIndex;
                const row = (
                  <button
                    key={branch.name}
                    className={styles.item}
                    data-highlighted={index === highlighted}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => onPick(branch)}
                  >
                    <GitBranch size={13} className={styles.icon} />
                    <span className={styles.name}>
                      <Highlight text={branch.name} />
                    </span>
                    {branch.name === currentBranch && <span className={styles.current}>Current</span>}
                  </button>
                );
                return menu ? (
                  <ActionContextMenu key={branch.name} entries={() => menu(branch)}>
                    {row}
                  </ActionContextMenu>
                ) : (
                  row
                );
              })}
            </div>
          ))}
        </div>
      </HighlightQuery>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}

function filterGroups(groups: BranchGroup[], query: string): BranchGroup[] {
  const needle = query.trim().toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      branches: needle ? group.branches.filter((branch) => branch.name.toLowerCase().includes(needle)) : group.branches,
    }))
    .filter((group) => group.branches.length > 0);
}
