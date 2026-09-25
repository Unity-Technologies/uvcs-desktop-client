import { GitBranch, Search } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Branch } from '@shared/domain/branch';
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
  /** Rendered below the list, e.g. a "New branch" button. */
  footer?: ReactNode;
}

/** A searchable, keyboard-driven list of branches in titled groups. */
export function BranchSearchList({ groups, onPick, currentBranch, placeholder = 'Find a branch', footer }: BranchSearchListProps) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const visibleGroups = useMemo(() => filterGroups(groups, query), [groups, query]);
  const flat = visibleGroups.flatMap((group) => group.branches);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((index) => Math.min(flat.length - 1, Math.max(0, index + step)));
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
      <div className={styles.list}>
        {flat.length === 0 && <div className={styles.empty}>No branches match “{query}”.</div>}
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.title}>
            <div className={styles.groupTitle}>{group.title}</div>
            {group.branches.map((branch, branchIndex) => {
              const index = groupOffsets[groupIndex]! + branchIndex;
              return (
                <button
                  key={`${group.title}:${branch.name}`}
                  className={styles.item}
                  data-highlighted={index === highlighted}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => onPick(branch)}
                >
                  <GitBranch size={13} className={styles.icon} />
                  <span className={styles.name}>{branch.name}</span>
                  {branch.name === currentBranch && <span className={styles.current}>Current</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
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
