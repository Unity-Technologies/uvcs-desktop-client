import { EyeOff, Filter, Home, Maximize } from 'lucide-react';
import { useMemo } from 'react';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useBranchExplorerPreferences } from './branchExplorerStore';

interface BranchExplorerCommandHandlers {
  goHome: () => void;
  fit: () => void;
}

/** Palette commands available while the Branch Explorer is open. */
export function useBranchExplorerCommands({ goHome, fit }: BranchExplorerCommandHandlers): void {
  const { onlyRelatedToCurrent, hideMergedBranches, set } = useBranchExplorerPreferences();

  const commands = useMemo<Command[]>(
    () => [
      { id: 'branchExplorer.home', group: 'Branch Explorer', label: 'Go to workspace changeset', icon: Home, run: goHome },
      { id: 'branchExplorer.fit', group: 'Branch Explorer', label: 'Fit graph to window', icon: Maximize, run: fit },
      {
        id: 'branchExplorer.related',
        group: 'Branch Explorer',
        label: onlyRelatedToCurrent ? 'Show all branches' : 'Show only branches related to mine',
        icon: Filter,
        run: () => set({ onlyRelatedToCurrent: !onlyRelatedToCurrent }),
      },
      {
        id: 'branchExplorer.merged',
        group: 'Branch Explorer',
        label: hideMergedBranches ? 'Show merged branches' : 'Hide merged branches',
        icon: EyeOff,
        run: () => set({ hideMergedBranches: !hideMergedBranches }),
      },
    ],
    [goHome, fit, onlyRelatedToCurrent, hideMergedBranches, set],
  );

  useCommands(commands);
}
