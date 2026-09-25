import { Archive, CherryIcon, GitMerge, GitPullRequestArrow, Undo2 } from 'lucide-react';
import { useMemo } from 'react';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { prompt } from '../../ui/dialog/prompt';
import { openMerge } from './mergeOperations';
import { pickBranch } from './pickBranch';

/** Palette commands to start any kind of merge. */
export function useMergeCommands(): void {
  const { data: workspace } = useWorkspaceInfo();
  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'merge.fromBranch',
        group: 'Merge',
        label: 'Merge from branch…',
        icon: GitMerge,
        shortcut: 'mod+shift+m',
        run: async () => {
          const branch = await pickBranch({ title: 'Merge from branch', confirmLabel: 'Preview merge', exclude: currentBranch });
          if (branch) openMerge({ kind: 'merge', sourceSpec: `br:${branch}` });
        },
      },
      {
        id: 'merge.toBranch',
        group: 'Merge',
        label: 'Merge current branch into another branch…',
        icon: GitPullRequestArrow,
        disabled: !currentBranch,
        run: async () => {
          const destination = await pickBranch({ title: `Merge ${currentBranch} into`, confirmLabel: 'Preview merge', exclude: currentBranch });
          if (destination) openMerge({ kind: 'merge', sourceSpec: `br:${currentBranch}`, destinationBranch: destination });
        },
      },
      {
        id: 'merge.cherryPick',
        group: 'Merge',
        label: 'Cherry pick changeset…',
        icon: CherryIcon,
        run: async () => {
          const changeset = await askChangeset('Cherry pick changeset', 'Cherry pick');
          if (changeset) openMerge({ kind: 'cherryPick', sourceSpec: `cs:${changeset}` });
        },
      },
      {
        id: 'merge.applyShelve',
        group: 'Merge',
        label: 'Apply shelve…',
        icon: Archive,
        run: async () => {
          const answer = await prompt({ title: 'Apply shelve', label: 'Shelve number', confirmLabel: 'Preview' });
          const shelve = parsePositiveNumber(answer, 'sh:');
          if (shelve) openMerge({ kind: 'merge', sourceSpec: `sh:${shelve}` });
        },
      },
      {
        id: 'merge.subtractive',
        group: 'Merge',
        label: 'Undo the changes of a changeset (subtractive merge)…',
        icon: Undo2,
        run: async () => {
          const changeset = await askChangeset('Undo the changes of a changeset', 'Preview');
          if (changeset) openMerge({ kind: 'subtractive', sourceSpec: `cs:${changeset}` });
        },
      },
    ],
    [currentBranch],
  );

  useCommands(commands);
}

async function askChangeset(title: string, confirmLabel: string): Promise<number | undefined> {
  return parsePositiveNumber(await prompt({ title, label: 'Changeset number', confirmLabel }), 'cs:');
}

/** Accepts `12` or `cs:12` (with the given prefix). */
function parsePositiveNumber(answer: string | undefined, prefix: string): number | undefined {
  const value = Number(answer?.replace(prefix, ''));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}
