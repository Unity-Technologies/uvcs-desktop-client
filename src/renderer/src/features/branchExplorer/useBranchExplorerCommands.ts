import { EyeOff, Filter, FoldHorizontal, Home, Maximize, Search } from 'lucide-react';
import { useMemo } from 'react';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { hotkey } from '../../lib/shortcutRegistry';
import { useBranchExplorerPreferences } from './branchExplorerStore';

interface BranchExplorerCommandHandlers {
  goHome: () => void;
  fit: () => void;
  find: () => void;
}

/** Palette commands available while the Branch Explorer is open. */
export function useBranchExplorerCommands({ goHome, fit, find }: BranchExplorerCommandHandlers): void {
  const { onlyRelatedToCurrent, hideMergedBranches, structureOnly, set } = useBranchExplorerPreferences();

  const commands = useMemo<Command[]>(
    () => [
      { id: 'branchExplorer.find', group: 'Branch Explorer', label: 'Find in graph', icon: Search, shortcut: hotkey('graphFind'), run: find },
      { id: 'branchExplorer.home', group: 'Branch Explorer', label: 'Go to the workspace', icon: Home, run: goHome },
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
      {
        id: 'branchExplorer.structureOnly',
        group: 'Branch Explorer',
        label: structureOnly ? 'Show all changesets' : 'Show only relevant changesets',
        icon: FoldHorizontal,
        run: () => set({ structureOnly: !structureOnly }),
      },
    ],
    [goHome, fit, find, onlyRelatedToCurrent, hideMergedBranches, structureOnly, set],
  );

  useCommands(commands);
}
