import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { displayName } from '../../lib/userName';
import { Button } from '../../ui/Button';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { BranchFilterPopover } from './BranchFilterPopover';
import { FocusChip } from './FocusChip';
import type { GraphFocus } from './model/filterGraph';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { ZOOM_STEP } from './canvas/zoom';
import { DATE_RANGES } from './model/dateRanges';
import styles from './BranchExplorerView.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

interface GraphFilterBarProps {
  /** Every branch in the loaded history, by name. */
  branches: readonly string[];
  /** Everyone who authored a changeset in the loaded history. */
  authors: string[];
  onZoom: (factor: number) => void;
  onFit: () => void;
  onGoHome: () => void;
  /** The branch whose relatives the graph shows, if any. */
  focus: GraphFocus | null;
  onFocusHopsChange: (hops: number) => void;
  onExitFocus: () => void;
}

/** Compact dropdowns for what to show: branches, authors, time range and view options, then the focus if any. */
export function GraphFilterBar({ branches, authors, onZoom, onFit, onGoHome, focus, onFocusHopsChange, onExitFocus }: GraphFilterBarProps) {
  const preferences = useBranchExplorerPreferences();
  const { set } = preferences;
  const check = (value: boolean) => (value ? Check : undefined);

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
    {
      id: 'structureOnly',
      label: 'Only relevant changesets',
      icon: check(preferences.structureOnly),
      run: () => set({ structureOnly: !preferences.structureOnly }),
    },
    SEPARATOR,
    { id: 'comments', label: 'Show comments', icon: check(preferences.showComments), run: () => set({ showComments: !preferences.showComments }) },
    { id: 'avatars', label: 'Show avatars', icon: check(preferences.showAvatars), run: () => set({ showAvatars: !preferences.showAvatars }) },
    { id: 'details', label: 'Show details panel', icon: check(preferences.detailsOpen), shortcut: hotkey('graphDetails'), run: () => set({ detailsOpen: !preferences.detailsOpen }) },
    SEPARATOR,
    { id: 'zoomIn', label: 'Zoom in', shortcut: hotkey('graphZoomIn'), run: () => onZoom(ZOOM_STEP) },
    { id: 'zoomOut', label: 'Zoom out', shortcut: hotkey('graphZoomOut'), run: () => onZoom(1 / ZOOM_STEP) },
    { id: 'fit', label: 'Fit to window', shortcut: hotkey('graphFit'), run: onFit },
    SEPARATOR,
    { id: 'home', label: 'Go to workspace changeset', shortcut: hotkey('graphHome'), run: onGoHome },
  ];

  return (
    <div className={styles.filterBar}>
      <BranchFilterPopover branches={branches} />
      <FilterPill entries={authorsMenu} active={preferences.highlightedAuthor !== null}>
        Authors
        {preferences.highlightedAuthor && <span className={styles.filterValue}>{displayName(preferences.highlightedAuthor)}</span>}
      </FilterPill>
      <FilterPill entries={dateMenu}>{DATE_RANGES.find((range) => range.id === preferences.dateRange)?.label}</FilterPill>
      <FilterPill entries={viewMenu} active={preferences.structureOnly}>
        View
        {preferences.structureOnly && <span className={styles.filterValue}>Relevant only</span>}
      </FilterPill>
      {focus && <FocusChip focus={focus} onHopsChange={onFocusHopsChange} onExit={onExitFocus} />}
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
