import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { matchesAllWords } from '../../lib/matchesAllWords';
import { Checkbox } from '../../ui/Checkbox';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { SearchField } from '../../ui/SearchField';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { branchChooser, setBranchesChosen } from './model/branchChoice';
import styles from './BranchFilterPopover.module.css';

/** Matches `.rowLabel` in the CSS. */
const ROW_HEIGHT = 26;

/**
 * The Branches filter's checklist: find branches by name and check them one by one or all that match. Rendered only
 * while the filter is open, and only the rows in view: a repository can have 20,000 branches.
 */
export function BranchChecklist({ branches }: { branches: readonly string[] }) {
  const { set, visibleBranches } = useBranchExplorerPreferences();
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const matching = useMemo(() => (search.trim() ? branches.filter((name) => matchesAllWords(name, search)) : branches), [branches, search]);
  const isChosen = useMemo(() => branchChooser(visibleBranches), [visibleBranches]);
  const chosenCount = useMemo(() => (visibleBranches === null ? branches.length : branches.filter(isChosen).length), [branches, visibleBranches, isChosen]);
  const virtualizer = useVirtualizer({ count: matching.length, getScrollElement: () => listRef.current, estimateSize: () => ROW_HEIGHT, overscan: 8 });

  const choose = (names: readonly string[], checked: boolean): void => set({ visibleBranches: setBranchesChosen(visibleBranches, branches, names, checked) });
  const scope = search.trim() ? 'matching' : 'all';

  return (
    <div className={styles.picker}>
      <SearchField
        value={search}
        onChange={(value) => {
          setSearch(value);
          listRef.current?.scrollTo({ top: 0 });
        }}
        placeholder="Filter branches"
        width="100%"
        autoFocus
      />
      <div className={styles.summary}>
        <span>
          {chosenCount} of {branches.length} checked
        </span>
        <span className={styles.bulk}>
          <button type="button" className={styles.link} onClick={() => choose(matching, true)} disabled={matching.length === 0}>
            Check {scope}
          </button>
          <button type="button" className={styles.link} onClick={() => choose(matching, false)} disabled={matching.length === 0}>
            Uncheck {scope}
          </button>
        </span>
      </div>
      <HighlightQuery query={search}>
        <div ref={listRef} className={styles.list}>
          <ul className={styles.rows} style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => {
              const name = matching[row.index]!;
              return (
                <li key={name} className={styles.row} style={{ top: row.start, height: row.size }}>
                  <label className={styles.rowLabel}>
                    <Checkbox checked={isChosen(name)} onChange={(checked) => choose([name], checked)} />
                    <span className={styles.name}>
                      <Highlight text={name} />
                    </span>
                  </label>
                  <button type="button" className={styles.only} onClick={() => set({ visibleBranches: [name] })}>
                    Only
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </HighlightQuery>
      {matching.length === 0 && <p className={styles.empty}>No branch matches “{search.trim()}”</p>}
    </div>
  );
}
