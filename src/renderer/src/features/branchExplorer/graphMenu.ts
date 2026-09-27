import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Copy,
  CornerLeftUp,
  FileDiff,
  Filter,
  GitBranch,
  GitCommitVertical,
  GitBranchPlus,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  Minus,
  Tag,
} from 'lucide-react';
import { spec } from '@shared/domain/specs';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../lib/actions';
import { openCreateBranchDialog } from '../branches/CreateBranchDialog';
import { openCreateLabelDialog } from '../labels/CreateLabelDialog';
import { openMergeTaskDialog } from '../mergeTask/MergeTaskDialog';
import { serverMergeLabel } from '../branches/mergeMenuLabels';
import { isTaskBranch } from '../mergeTask/mergeTaskSummary';
import type { GraphTarget } from './canvas/graphTargets';
import { graphActions } from './graphActions';
import type { GraphLayout, Lane } from './model/layoutGraph';

interface GraphMenuContext {
  workspacePath: string;
  layout: GraphLayout;
  /** Selects and scrolls to a changeset. */
  goToChangeset: (id: number) => void;
  showRelatedTo: (branchName: string) => void;
  /** Selects and reveals a branch created from the menu, once the graph has it. */
  revealCreatedBranch: (name: string) => void;
}

export function graphMenu(target: GraphTarget | null, context: GraphMenuContext): MenuEntry[] {
  switch (target?.kind) {
    case 'changeset':
      return changesetMenu(target.id, context);
    case 'branch':
      return branchMenu(target.lane, context);
    case 'label':
      return labelMenu(target.label.name, target.label.changeset, context);
    case 'mergeLink':
      return [
        { id: 'source', label: 'Go to source changeset', icon: ArrowLeftToLine, run: () => context.goToChangeset(target.link.sourceChangeset) },
        {
          id: 'destination',
          label: 'Go to destination changeset',
          icon: ArrowRightToLine,
          run: () => context.goToChangeset(target.link.destinationChangeset),
        },
        SEPARATOR,
        { id: 'diff', label: 'Diff merged changeset', icon: FileDiff, run: () => graphActions.diffChangeset(target.link.destinationChangeset) },
      ];
    default:
      return [];
  }
}

function changesetMenu(id: number, { workspacePath, layout, goToChangeset, revealCreatedBranch }: GraphMenuContext): MenuEntry[] {
  const changeset = layout.nodes.get(id)?.changeset;
  const parent = changeset?.parent ?? -1;
  return tidyMenu([
    { id: 'diff', label: 'Diff changeset', icon: FileDiff, run: () => graphActions.diffChangeset(id) },
    { id: 'switch', label: 'Switch workspace to this changeset', icon: GitCommitVertical, run: () => graphActions.switchToChangeset(workspacePath, id) },
    SEPARATOR,
    changeset && {
      id: 'createBranch',
      label: 'Create branch from here…',
      icon: GitBranchPlus,
      run: () =>
        void openCreateBranchDialog(workspacePath, {
          parentBranch: changeset.branch,
          startingPoint: spec.changeset(id),
          startingPointLabel: `changeset ${id}`,
        }).then((name) => name && revealCreatedBranch(name)),
    },
    { id: 'label', label: 'Label this changeset…', icon: Tag, run: () => openCreateLabelDialog(workspacePath, id) },
    SEPARATOR,
    { id: 'merge', label: 'Merge from this changeset', icon: GitMerge, run: () => graphActions.merge('merge', spec.changeset(id)) },
    { id: 'cherryPick', label: 'Cherry pick this changeset', icon: GitPullRequestArrow, run: () => graphActions.merge('cherryPick', spec.changeset(id)) },
    { id: 'subtractive', label: 'Subtractive merge…', icon: Minus, run: () => graphActions.merge('subtractive', spec.changeset(id)) },
    SEPARATOR,
    layout.nodes.has(parent) && { id: 'parent', label: 'Go to parent changeset', icon: CornerLeftUp, run: () => goToChangeset(parent) },
    { id: 'copy', label: 'Copy changeset spec', icon: Copy, run: () => graphActions.copy(spec.changeset(id)) },
  ]);
}

function branchMenu(lane: Lane, { workspacePath, layout, goToChangeset, showRelatedTo }: GraphMenuContext): MenuEntry[] {
  const name = lane.branch.name;
  const head = lane.branch.headChangeset;
  return tidyMenu([
    { id: 'switch', label: 'Switch workspace to this branch', icon: GitBranch, run: () => graphActions.switchToBranch(workspacePath, name) },
    { id: 'merge', label: 'Merge from this branch', icon: GitMerge, run: () => graphActions.merge('merge', spec.branch(name)) },
    isTaskBranch(lane.branch) && {
      id: 'mergeTask',
      label: serverMergeLabel(lane.branch.parent),
      icon: GitPullRequest,
      run: () => openMergeTaskDialog(workspacePath, lane.branch),
    },
    { id: 'diff', label: 'Diff branch', icon: FileDiff, run: () => graphActions.diffBranch(lane.branch) },
    SEPARATOR,
    layout.nodes.has(head) && { id: 'head', label: 'Go to head changeset', icon: ArrowRightToLine, run: () => goToChangeset(head) },
    lane.baseChangeset !== null && {
      id: 'base',
      label: 'Go to branch base',
      icon: ArrowLeftToLine,
      run: () => goToChangeset(lane.baseChangeset!),
    },
    { id: 'related', label: 'Show only related branches', icon: Filter, run: () => showRelatedTo(name) },
    SEPARATOR,
    { id: 'copy', label: 'Copy branch spec', icon: Copy, run: () => graphActions.copy(spec.branch(name)) },
  ]);
}

function labelMenu(name: string, changeset: number, { workspacePath, goToChangeset }: GraphMenuContext): MenuEntry[] {
  return [
    { id: 'switch', label: 'Switch workspace to this label', icon: Tag, run: () => graphActions.switchToLabel(workspacePath, name) },
    { id: 'merge', label: 'Merge from this label', icon: GitMerge, run: () => graphActions.merge('merge', spec.label(name)) },
    { id: 'diff', label: 'Diff labeled changeset', icon: FileDiff, run: () => graphActions.diffChangeset(changeset) },
    SEPARATOR,
    { id: 'changeset', label: 'Go to labeled changeset', icon: GitCommitVertical, run: () => goToChangeset(changeset) },
    { id: 'copy', label: 'Copy label spec', icon: Copy, run: () => graphActions.copy(spec.label(name)) },
  ];
}
