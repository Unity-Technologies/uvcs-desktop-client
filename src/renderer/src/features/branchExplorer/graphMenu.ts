import {
  ArrowLeftToLine,
  ArrowRightLeft,
  ArrowRightToLine,
  Cherry,
  Copy,
  CornerLeftUp,
  FileDiff,
  Filter,
  GitCommitVertical,
  GitBranchPlus,
  GitMerge,
  GitPullRequest,
  Minus,
  Tag,
} from 'lucide-react';
import { spec } from '@shared/domain/specs';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { openCreateBranchDialog } from '../branches/CreateBranchDialog';
import { openCreateLabelDialog } from '../labels/CreateLabelDialog';
import { openMergeTaskDialog } from '../mergeTask/MergeTaskDialog';
import { MERGE_INTO_WORKSPACE, serverMergeLabel } from '../branches/mergeMenuLabels';
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

/** The graph's menus follow the lists' (`changesetMenu`, `branchMenu`, `labelMenu`): the same words, icons and order. */
export function graphMenu(target: GraphTarget | null, context: GraphMenuContext): MenuEntry[] {
  switch (target?.kind) {
    case 'changeset':
      return changesetMenu(target.id, context);
    case 'branch':
      return branchMenu(target.lane, context);
    case 'label':
      return labelMenu(target.label.name, target.label.changeset, context);
    case 'mergeLink':
      return groupedMenu({
        primary: [{ id: 'diff', label: 'Open diff of the merge', icon: FileDiff, run: () => graphActions.diffChangeset(target.link.destinationChangeset) }],
        navigate: [
          { id: 'source', label: 'Go to source changeset', icon: ArrowLeftToLine, run: () => context.goToChangeset(target.link.sourceChangeset) },
          {
            id: 'destination',
            label: 'Go to destination changeset',
            icon: ArrowRightToLine,
            run: () => context.goToChangeset(target.link.destinationChangeset),
          },
        ],
      });
    default:
      return [];
  }
}

function changesetMenu(id: number, { workspacePath, layout, goToChangeset, revealCreatedBranch }: GraphMenuContext): MenuEntry[] {
  const changeset = layout.nodes.get(id)?.changeset;
  const parent = changeset?.parent ?? -1;
  return groupedMenu({
    primary: [{ id: 'diff', label: 'Open diff', icon: FileDiff, run: () => graphActions.diffChangeset(id) }],
    act: [
      { id: 'switch', label: 'Switch to this changeset', icon: ArrowRightLeft, run: () => graphActions.switchToChangeset(workspacePath, id) },
      SEPARATOR,
      { id: 'merge', label: MERGE_INTO_WORKSPACE, icon: GitMerge, run: () => graphActions.merge('merge', spec.changeset(id)) },
      { id: 'cherryPick', label: 'Cherry pick this changeset', icon: Cherry, run: () => graphActions.merge('cherryPick', spec.changeset(id)) },
      { id: 'subtractive', label: 'Subtractive merge (remove its changes)', icon: Minus, run: () => graphActions.merge('subtractive', spec.changeset(id)) },
    ],
    create: [
      changeset && {
        id: 'createBranch',
        label: 'New branch from here…',
        icon: GitBranchPlus,
        run: () =>
          void openCreateBranchDialog(workspacePath, {
            parentBranch: changeset.branch,
            startingPoint: spec.changeset(id),
            startingPointLabel: `changeset ${id}`,
          }).then((name) => name && revealCreatedBranch(name)),
      },
      { id: 'label', label: 'New label…', icon: Tag, run: () => openCreateLabelDialog(workspacePath, id) },
    ],
    navigate: [layout.nodes.has(parent) && { id: 'parent', label: 'Go to parent changeset', icon: CornerLeftUp, run: () => goToChangeset(parent) }],
    copy: [{ id: 'copy', label: 'Copy changeset spec', icon: Copy, run: () => graphActions.copy(spec.changeset(id)) }],
  });
}

function branchMenu(lane: Lane, { workspacePath, layout, goToChangeset, showRelatedTo }: GraphMenuContext): MenuEntry[] {
  const name = lane.branch.name;
  const head = lane.branch.headChangeset;
  return groupedMenu({
    primary: [{ id: 'diff', label: 'Open diff', icon: FileDiff, run: () => graphActions.diffBranch(lane.branch) }],
    act: [
      { id: 'switch', label: 'Switch to this branch', icon: ArrowRightLeft, run: () => graphActions.switchToBranch(workspacePath, name) },
      SEPARATOR,
      { id: 'merge', label: MERGE_INTO_WORKSPACE, icon: GitMerge, run: () => graphActions.merge('merge', spec.branch(name)) },
      isTaskBranch(lane.branch) && {
        id: 'mergeTask',
        label: serverMergeLabel(lane.branch.parent),
        icon: GitPullRequest,
        run: () => openMergeTaskDialog(workspacePath, lane.branch),
      },
    ],
    navigate: [
      layout.nodes.has(head) && { id: 'head', label: 'Go to head changeset', icon: ArrowRightToLine, run: () => goToChangeset(head) },
      lane.baseChangeset !== null && {
        id: 'base',
        label: 'Go to branch base',
        icon: ArrowLeftToLine,
        run: () => goToChangeset(lane.baseChangeset!),
      },
      { id: 'related', label: 'Show only related branches', icon: Filter, run: () => showRelatedTo(name) },
    ],
    copy: [{ id: 'copy', label: 'Copy branch spec', icon: Copy, run: () => graphActions.copy(spec.branch(name)) }],
  });
}

function labelMenu(name: string, changeset: number, { workspacePath, goToChangeset }: GraphMenuContext): MenuEntry[] {
  return groupedMenu({
    primary: [{ id: 'diff', label: 'Open diff', icon: FileDiff, run: () => graphActions.diffChangeset(changeset) }],
    act: [
      { id: 'switch', label: 'Switch to this label', icon: ArrowRightLeft, run: () => graphActions.switchToLabel(workspacePath, name) },
      SEPARATOR,
      { id: 'merge', label: MERGE_INTO_WORKSPACE, icon: GitMerge, run: () => graphActions.merge('merge', spec.label(name)) },
    ],
    navigate: [{ id: 'changeset', label: 'Go to labeled changeset', icon: GitCommitVertical, run: () => goToChangeset(changeset) }],
    copy: [{ id: 'copy', label: 'Copy label spec', icon: Copy, run: () => graphActions.copy(spec.label(name)) }],
  });
}
