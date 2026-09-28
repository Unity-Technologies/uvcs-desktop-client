import { Check, SlidersHorizontal } from 'lucide-react';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { hotkey } from '../../lib/shortcutRegistry';
import { PeopleFilter } from '../../components/people/PeopleFilter';
import { SincePicker } from '../../components/SincePicker';
import { FilterBar } from '../../ui/FilterBar';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { MenuChip } from '../../ui/ToggleChip';
import { BranchFilterPopover } from './BranchFilterPopover';
import { FocusChip } from './FocusChip';
import type { GraphFocus } from './model/filterGraph';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { ZOOM_STEP } from './canvas/zoom';

interface GraphFilterBarProps {
  /** Every branch in the loaded history, by name. */
  branches: readonly string[];
  /** Everyone who authored a changeset in the loaded history. */
  authors: readonly string[];
  onZoom: (factor: number) => void;
  onFit: () => void;
  onGoHome: () => void;
  /** The branch whose relatives the graph shows, if any. */
  focus: GraphFocus | null;
  onFocusHopsChange: (hops: number) => void;
  onExitFocus: () => void;
}

/**
 * The Branch Explorer's filter bar, in every view's order: whose changesets stand out (the others fade), how far back
 * the history goes, which branches, then what the graph draws and the focus if any. Finding is the search's, above.
 */
export function GraphFilterBar({ branches, authors, onZoom, onFit, onGoHome, focus, onFocusHopsChange, onExitFocus }: GraphFilterBarProps) {
  const preferences = useBranchExplorerPreferences();
  const { set } = preferences;
  const check = (value: boolean) => (value ? Check : undefined);

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
    <FilterBar
      people={<PeopleFilter value={preferences.people} onChange={(people) => set({ people })} people={authors} mineTip="Make your changesets stand out" />}
      time={<SincePicker value={preferences.dateRange} onChange={(dateRange) => set({ dateRange })} />}
      kinds={<BranchFilterPopover branches={branches} />}
      view={
        <>
          {focus && <FocusChip focus={focus} onHopsChange={onFocusHopsChange} onExit={onExitFocus} />}
          <ActionDropdownMenu entries={viewMenu} align="end">
            <MenuChip icon={<SlidersHorizontal size={13} />} active={preferences.structureOnly}>
              {preferences.structureOnly ? 'Relevant only' : 'View'}
            </MenuChip>
          </ActionDropdownMenu>
        </>
      }
    />
  );
}
