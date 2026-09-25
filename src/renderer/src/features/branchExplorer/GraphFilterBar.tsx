import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { displayName } from '../../lib/userName';
import { Button } from '../../ui/Button';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { DATE_RANGES } from './model/dateRanges';
import styles from './BranchExplorerView.module.css';

interface GraphFilterBarProps {
  /** Everyone who authored a changeset in the loaded history. */
  authors: string[];
  onZoom: (factor: number) => void;
  onFit: () => void;
  onGoHome: () => void;
}

const ZOOM_STEP = 1.25;

/** Compact dropdowns for what to show: branches, authors, time range and view options. */
export function GraphFilterBar({ authors, onZoom, onFit, onGoHome }: GraphFilterBarProps) {
  const preferences = useBranchExplorerPreferences();
  const { set } = preferences;
  const check = (value: boolean) => (value ? Check : undefined);

  const branchFilterCount = [preferences.onlyRelatedToCurrent, preferences.hideMergedBranches, preferences.showHiddenBranches].filter(Boolean).length;
  const branchesMenu: MenuEntry[] = [
    {
      id: 'related',
      label: 'Only branches related to mine',
      icon: check(preferences.onlyRelatedToCurrent),
      run: () => set({ onlyRelatedToCurrent: !preferences.onlyRelatedToCurrent }),
    },
    { id: 'merged', label: 'Hide merged branches', icon: check(preferences.hideMergedBranches), run: () => set({ hideMergedBranches: !preferences.hideMergedBranches }) },
    { id: 'hidden', label: 'Show hidden branches', icon: check(preferences.showHiddenBranches), run: () => set({ showHiddenBranches: !preferences.showHiddenBranches }) },
  ];

  const authorsMenu: MenuEntry[] = [
    { id: 'everyone', label: 'Everyone', icon: check(preferences.highlightedAuthor === null), run: () => set({ highlightedAuthor: null }) },
    SEPARATOR,
    ...authors.map((author) => ({
      id: `author.${author}`,
      label: displayName(author),
      icon: check(preferences.highlightedAuthor === author),
      run: () => set({ highlightedAuthor: author }),
    })),
  ];

  const dateMenu: MenuEntry[] = DATE_RANGES.map((range) => ({
    id: range.id,
    label: range.label,
    icon: check(range.id === preferences.dateRange),
    run: () => set({ dateRange: range.id }),
  }));

  const viewMenu: MenuEntry[] = [
    { id: 'comments', label: 'Show comments', icon: check(preferences.showComments), run: () => set({ showComments: !preferences.showComments }) },
    { id: 'avatars', label: 'Show avatars', icon: check(preferences.showAvatars), run: () => set({ showAvatars: !preferences.showAvatars }) },
    { id: 'details', label: 'Show details panel', icon: check(preferences.detailsOpen), run: () => set({ detailsOpen: !preferences.detailsOpen }) },
    SEPARATOR,
    { id: 'zoomIn', label: 'Zoom in', shortcut: '+', run: () => onZoom(ZOOM_STEP) },
    { id: 'zoomOut', label: 'Zoom out', shortcut: '-', run: () => onZoom(1 / ZOOM_STEP) },
    { id: 'fit', label: 'Fit to window', shortcut: '0', run: onFit },
    { id: 'home', label: 'Go to workspace changeset', shortcut: 'h', run: onGoHome },
  ];

  return (
    <div className={styles.filterBar}>
      <FilterPill entries={branchesMenu} active={branchFilterCount > 0}>
        {branchFilterCount > 0 ? `Branches · ${branchFilterCount}` : 'Branches'}
      </FilterPill>
      <FilterPill entries={authorsMenu} active={preferences.highlightedAuthor !== null}>
        {preferences.highlightedAuthor ? displayName(preferences.highlightedAuthor) : 'Authors'}
      </FilterPill>
      <FilterPill entries={dateMenu}>{DATE_RANGES.find((range) => range.id === preferences.dateRange)?.label}</FilterPill>
      <FilterPill entries={viewMenu}>View</FilterPill>
    </div>
  );
}

function FilterPill({ entries, active = false, children }: { entries: MenuEntry[]; active?: boolean; children: ReactNode }) {
  return (
    <ActionDropdownMenu entries={entries} align="start">
      <Button size="small" className={styles.filterPill} data-active={active}>
        {children}
        <ChevronDown size={12} className={styles.filterChevron} />
      </Button>
    </ActionDropdownMenu>
  );
}
