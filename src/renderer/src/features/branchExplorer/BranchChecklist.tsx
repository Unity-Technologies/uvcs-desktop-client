import { useMemo, useState } from 'react';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { FilterChecklist } from '../../ui/FilterChecklist';
import { Highlight } from '../../ui/Highlight';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { branchChooser, setBranchesChosen } from './model/branchChoice';
import styles from './BranchFilterPopover.module.css';

/**
 * The Branches filter's checklist: find branches by name and check them one by one or all that match. Rendered only
 * while the filter is open, and only the rows in view: a repository can have 20,000 branches.
 */
export function BranchChecklist({ branches }: { branches: readonly string[] }) {
  const { set, visibleBranches } = useBranchExplorerPreferences();
  const [search, setSearch] = useState('');

  const matching = useMemo(() => (search.trim() ? branches.filter((name) => matchesWordFilter([name], search)) : branches), [branches, search]);
  const isChosen = useMemo(() => branchChooser(visibleBranches), [visibleBranches]);
  const chosenCount = useMemo(() => (visibleBranches === null ? branches.length : branches.filter(isChosen).length), [branches, visibleBranches, isChosen]);

  const choose = (names: readonly string[], checked: boolean): void => set({ visibleBranches: setBranchesChosen(visibleBranches, branches, names, checked) });
  const scope = search.trim() ? 'matching' : 'all';

  return (
    <FilterChecklist
      rows={matching}
      search={search}
      onSearchChange={setSearch}
      placeholder="Filter branches"
      label="Branches"
      isChecked={isChosen}
      onToggle={(name) => choose([name], !isChosen(name))}
      onOnly={(name) => set({ visibleBranches: [name] })}
      renderRow={(name) => (
        <span className={styles.name}>
          <Highlight text={name} />
        </span>
      )}
      summary={
        <>
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
        </>
      }
      empty={<>No branch matches “{search.trim()}”</>}
    />
  );
}
