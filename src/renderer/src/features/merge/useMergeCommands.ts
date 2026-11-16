import { Archive, CherryIcon, GitMerge, GitPullRequestArrow, Undo2 } from 'lucide-react';
import { useMemo } from 'react';
import { spec } from '@shared/domain/specs';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { usePlace, useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { offersMerges } from '../../components/mergesOffered';
import { branchWorkedOn } from '../../components/workingObject';
import { branchLabel } from '../../lib/branchLabels';
import { hotkey } from '../../lib/shortcutRegistry';
import { prompt } from '../../ui/dialog/prompt';
import { pickBranch } from '../branches/BranchPickerDialog';
import { applyShelve } from '../shelves/shelveOperations';
import { mergeCommandsOffered, type MergeCommandId } from './mergeCommandsOffered';
import { openMerge } from './mergeOperations';

/**
 * Palette commands to start any kind of merge, and to apply a shelve; a partial workspace has only the latter
 * (`mergeCommandsOffered`). The app menu's merge items do nothing there (docs/features/partial-workspaces.md "No merges").
 */
export function useMergeCommands(): void {
  const { data: workspace } = useWorkspaceInfo();
  const workspacePath = useWorkspacePath();
  const currentBranch = branchWorkedOn(workspace?.selector);
  const merges = offersMerges({ place: usePlace(), workspaceKind: workspace?.kind });

  const commands = useMemo<Command[]>(() => {
    const all: Record<MergeCommandId, Command> = {
      'merge.fromBranch': {
        id: 'merge.fromBranch',
        group: 'Merge',
        label: 'Merge from branch…',
        icon: GitMerge,
        shortcut: hotkey('mergeFromBranch'),
        run: async () => {
          const branch = await pickBranch({ title: 'Merge from branch', exclude: currentBranch });
          if (branch) openMerge({ kind: 'merge', sourceSpec: spec.branch(branch.name) });
        },
      },
      'merge.toBranch': {
        id: 'merge.toBranch',
        group: 'Merge',
        label: 'Merge current branch into another branch…',
        icon: GitPullRequestArrow,
        disabled: !currentBranch,
        run: async () => {
          if (!currentBranch) return;
          const destination = await pickBranch({ title: `Merge ${branchLabel(currentBranch)} into`, exclude: currentBranch });
          if (destination) openMerge({ kind: 'merge', sourceSpec: spec.branch(currentBranch), destinationBranch: destination.name });
        },
      },
      'merge.cherryPick': {
        id: 'merge.cherryPick',
        group: 'Merge',
        label: 'Cherry pick changeset…',
        icon: CherryIcon,
        run: async () => {
          const changeset = await askChangeset('Cherry pick changeset', 'Cherry pick');
          if (changeset) openMerge({ kind: 'cherryPick', sourceSpec: spec.changeset(changeset) });
        },
      },
      'merge.subtractive': {
        id: 'merge.subtractive',
        group: 'Merge',
        label: 'Undo the changes of a changeset (subtractive merge)…',
        icon: Undo2,
        run: async () => {
          const changeset = await askChangeset('Undo the changes of a changeset', 'Preview');
          if (changeset) openMerge({ kind: 'subtractive', sourceSpec: spec.changeset(changeset) });
        },
      },
      'merge.applyShelve': {
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
    };
    return mergeCommandsOffered(merges).map((id) => all[id]);
  }, [currentBranch, workspacePath, merges]);

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
