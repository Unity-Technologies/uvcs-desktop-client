import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { matchesAllWords } from '../../lib/matchesAllWords';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { SearchField } from '../../ui/SearchField';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { isBranchChosen, setBranchesChosen } from './model/branchChoice';
import viewStyles from './BranchExplorerView.module.css';
import styles from './BranchFilterPopover.module.css';

/** The Branches pill: which kinds of branches to show, and a checklist to pick them one by one. */
export function BranchFilterPopover({ branches }: { branches: readonly string[] }) {
  const preferences = useBranchExplorerPreferences();
  const { set, visibleBranches } = preferences;
  const [search, setSearch] = useState('');

  const matching = useMemo(() => (search.trim() ? branches.filter((name) => matchesAllWords(name, search)) : branches), [branches, search]);
  const chosenCount = visibleBranches === null ? branches.length : branches.filter((name) => visibleBranches.includes(name)).length;
  const activeCount = [preferences.onlyRelatedToCurrent, preferences.hideMergedBranches, preferences.showHiddenBranches, visibleBranches !== null].filter(Boolean).length;

  const choose = (names: readonly string[], chosen: boolean): void => set({ visibleBranches: setBranchesChosen(visibleBranches, branches, names, chosen) });
  const scope = search.trim() ? 'matching' : 'all';

  const options = [
    { id: 'related', label: 'Only branches related to mine', checked: preferences.onlyRelatedToCurrent, toggle: () => set({ onlyRelatedToCurrent: !preferences.onlyRelatedToCurrent }) },
    { id: 'merged', label: 'Hide merged branches', checked: preferences.hideMergedBranches, toggle: () => set({ hideMergedBranches: !preferences.hideMergedBranches }) },
    { id: 'hidden', label: 'Show hidden branches', checked: preferences.showHiddenBranches, toggle: () => set({ showHiddenBranches: !preferences.showHiddenBranches }) },
  ];

  return (
    <Popover.Root onOpenChange={(open) => !open && setSearch('')}>
      <Popover.Trigger asChild>
        <Button size="small" className={viewStyles.filterPill} data-active={activeCount > 0}>
          Branches
          {activeCount > 0 && <span className={viewStyles.filterValue}>{activeCount}</span>}
          <ChevronDown size={12} className={viewStyles.filterChevron} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} align="start" sideOffset={4}>
          <div className={styles.options}>
            {options.map((option) => (
              <button key={option.id} type="button" role="menuitemcheckbox" aria-checked={option.checked} className={styles.option} onClick={option.toggle}>
                <span className={styles.check}>{option.checked && <Check size={13} />}</span>
                {option.label}
              </button>
            ))}
          </div>
          <div className={styles.picker}>
            <SearchField value={search} onChange={setSearch} placeholder="Filter branches" width="100%" autoFocus />
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
              <ul className={styles.list}>
                {matching.map((name) => (
                  <li key={name} className={styles.row}>
                    <label className={styles.rowLabel}>
                      <Checkbox checked={isBranchChosen(visibleBranches, name)} onChange={(checked) => choose([name], checked)} />
                      <span className={styles.name}>
                        <Highlight text={name} />
                      </span>
                    </label>
                    <button type="button" className={styles.only} onClick={() => set({ visibleBranches: [name] })}>
                      Only
                    </button>
                  </li>
                ))}
              </ul>
            </HighlightQuery>
            {matching.length === 0 && <p className={styles.empty}>No branch matches “{search.trim()}”</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
