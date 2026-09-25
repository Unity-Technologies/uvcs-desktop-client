import { CalendarRange, Check, ChevronDown, ChevronUp, Home, Maximize, PanelRight, RefreshCw, SlidersHorizontal, ZoomIn, ZoomOut } from 'lucide-react';
import type { MenuEntry } from '../../lib/actions';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { SearchField } from '../../ui/SearchField';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { DATE_RANGES } from './model/dateRanges';
import styles from './BranchExplorerView.module.css';

interface GraphSearchAndFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  /** Null while there is no search; `current` is 0 before stepping through the matches. */
  searchPosition: { current: number; total: number } | null;
  onSearchStep: (direction: 1 | -1) => void;
}

/** Search box, date range and filters, shown next to the view title. */
export function GraphSearchAndFilters({ search, onSearchChange, searchPosition, onSearchStep }: GraphSearchAndFiltersProps) {
  const preferences = useBranchExplorerPreferences();
  const activeRange = DATE_RANGES.find((range) => range.id === preferences.dateRange);
  const activeFilterCount = [preferences.onlyRelatedToCurrent, preferences.hideMergedBranches, preferences.showHiddenBranches].filter(Boolean).length;

  const dateRangeMenu: MenuEntry[] = DATE_RANGES.map((range) => ({
    id: range.id,
    label: range.label,
    icon: range.id === preferences.dateRange ? Check : undefined,
    run: () => preferences.set({ dateRange: range.id }),
  }));

  const toggle = (id: string, label: string, value: boolean, change: (value: boolean) => void): MenuEntry => ({
    id,
    label,
    icon: value ? Check : undefined,
    run: () => change(!value),
  });
  const filterMenu: MenuEntry[] = [
    toggle('related', 'Only branches related to mine', preferences.onlyRelatedToCurrent, (onlyRelatedToCurrent) => preferences.set({ onlyRelatedToCurrent })),
    toggle('merged', 'Hide merged branches', preferences.hideMergedBranches, (hideMergedBranches) => preferences.set({ hideMergedBranches })),
    toggle('hidden', 'Show hidden branches', preferences.showHiddenBranches, (showHiddenBranches) => preferences.set({ showHiddenBranches })),
  ];

  return (
    <>
      <div
        className={styles.search}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onSearchStep(event.shiftKey ? -1 : 1);
        }}
      >
        <SearchField value={search} onChange={onSearchChange} placeholder="Find changeset, branch, label…" width={250} />
        {searchPosition && (
          <>
            <span className={styles.searchCount}>{describeSearchPosition(searchPosition)}</span>
            <IconButton size="small" icon={<ChevronUp size={14} />} label="Previous match" shortcut="shift+enter" onClick={() => onSearchStep(-1)} />
            <IconButton size="small" icon={<ChevronDown size={14} />} label="Next match" shortcut="enter" onClick={() => onSearchStep(1)} />
          </>
        )}
      </div>
      <ActionDropdownMenu entries={dateRangeMenu} align="start">
        <Button variant="ghost" size="small" icon={<CalendarRange size={13} />}>
          {activeRange?.label}
        </Button>
      </ActionDropdownMenu>
      <ActionDropdownMenu entries={filterMenu} align="start">
        <Button variant={activeFilterCount > 0 ? 'secondary' : 'ghost'} size="small" icon={<SlidersHorizontal size={13} />}>
          {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
        </Button>
      </ActionDropdownMenu>
    </>
  );
}

function describeSearchPosition({ current, total }: { current: number; total: number }): string {
  if (total === 0) return 'No matches';
  if (current === 0) return total === 1 ? '1 match' : `${total} matches`;
  return `${current} of ${total}`;
}

interface GraphViewControlsProps {
  onZoom: (factor: number) => void;
  onFit: () => void;
  onGoHome: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}

/** Zoom, navigation, refresh and the details toggle, shown at the right of the header. */
export function GraphViewControls({ onZoom, onFit, onGoHome, onRefresh, refreshing }: GraphViewControlsProps) {
  const { detailsOpen, set } = useBranchExplorerPreferences();
  return (
    <>
      <IconButton icon={<ZoomOut size={15} />} label="Zoom out" shortcut="-" onClick={() => onZoom(1 / 1.25)} />
      <IconButton icon={<ZoomIn size={15} />} label="Zoom in" shortcut="+" onClick={() => onZoom(1.25)} />
      <IconButton icon={<Maximize size={14} />} label="Fit to window" shortcut="0" onClick={onFit} />
      <IconButton icon={<Home size={15} />} label="Go to workspace changeset" shortcut="h" onClick={onGoHome} />
      <IconButton icon={<RefreshCw size={14} className={refreshing ? styles.spinning : undefined} />} label="Refresh" onClick={onRefresh} />
      <IconButton
        icon={<PanelRight size={15} />}
        label={detailsOpen ? 'Hide details' : 'Show details'}
        variant={detailsOpen ? 'secondary' : 'ghost'}
        onClick={() => set({ detailsOpen: !detailsOpen })}
      />
    </>
  );
}
