import { Archive, CherryIcon, GitMerge, GitPullRequestArrow, Undo2 } from 'lucide-react';
import { useMemo } from 'react';
import { spec } from '@shared/domain/specs';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { hotkey } from '../../lib/shortcutRegistry';
import { prompt } from '../../ui/dialog/prompt';
import { pickBranch } from '../branches/BranchPickerDialog';
import { applyShelve } from '../shelves/shelveOperations';
import { openMerge } from './mergeOperations';

/** Palette commands to start any kind of merge. */
export function useMergeCommands(): void {
  const { data: workspace } = useWorkspaceInfo();
  const workspacePath = useWorkspacePath();
  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : undefined;

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'merge.fromBranch',
        group: 'Merge',
        label: 'Merge from branch…',
        icon: GitMerge,
        shortcut: hotkey('mergeFromBranch'),
        run: async () => {
          const branch = await pickBranch({ title: 'Merge from branch', exclude: currentBranch });
          if (branch) openMerge({ kind: 'merge', sourceSpec: spec.branch(branch) });
        },
      },
      {
        id: 'merge.toBranch',
        group: 'Merge',
        label: 'Merge current branch into another branch…',
        icon: GitPullRequestArrow,
        disabled: !currentBranch,
        run: async () => {
          const destination = await pickBranch({ title: `Merge ${currentBranch} into`, exclude: currentBranch });
          if (currentBranch && destination) openMerge({ kind: 'merge', sourceSpec: spec.branch(currentBranch), destinationBranch: destination });
        },
      },
      {
        id: 'merge.cherryPick',
        group: 'Merge',
        label: 'Cherry pick changeset…',
        icon: CherryIcon,
        run: async () => {
          const changeset = await askChangeset('Cherry pick changeset', 'Cherry pick');
          if (changeset) openMerge({ kind: 'cherryPick', sourceSpec: spec.changeset(changeset) });
        },
      },
      {
        id: 'merge.applyShelve',
        group: 'Merge',
        label: 'Apply shelve…',
        icon: Archive,
        run: async () => {
          const answer = await prompt({ title: 'Apply shelve', label: 'Shelve number', confirmLabel: 'Apply' });
          const shelve = parsePositiveNumber(answer, 'sh:');
          // Applied at once; only conflicts open the merge view.
          if (shelve) void applyShelve(workspacePath, shelve, false);
        },
      },
      {
        id: 'merge.subtractive',
        group: 'Merge',
        label: 'Undo the changes of a changeset (subtractive merge)…',
        icon: Undo2,
        run: async () => {
          const changeset = await askChangeset('Undo the changes of a changeset', 'Preview');
          if (changeset) openMerge({ kind: 'subtractive', sourceSpec: spec.changeset(changeset) });
        },
      },
    ],
    [currentBranch, workspacePath],
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
