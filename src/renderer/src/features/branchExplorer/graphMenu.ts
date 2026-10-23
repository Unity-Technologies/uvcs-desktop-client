import type { Place } from '@shared/domain/place';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { MenuEntry } from '../../lib/actions';
import { groupedMenu, withEntries } from '../../lib/menuGroups';
import { menuAction, type MenuHost } from '../../components/menuWords';
import { branchMenu } from '../branches/branchMenu';
import { changesetMenu } from '../changesets/changesetMenu';
import { codeReviewMenu } from '../codeReviews/codeReviewMenu';
import { labelMenu } from '../labels/labelMenu';
import type { GraphTarget } from './canvas/graphTargets';
import { graphActions } from './graphActions';
import { labelInfo } from './model/graphLabels';
import type { GraphLayout, Lane } from './model/layoutGraph';

interface GraphMenuContext {
  place: Place;
  layout: GraphLayout;
  /** What the workspace is on, as the lists' menus take it. */
  currentBranch: string | undefined;
  loadedChangeset: number | null | undefined;
  /** The graph's objects don't say their repository; the full specs need it. */
  repository: string | undefined;
  goToChangeset: (id: number) => void;
  showRelatedTo: (branch: string) => void;
  revealCreatedBranch: (name: string) => void;
}

/**
 * The graph's menus are the lists' (`changesetMenu`, `branchMenu`, `labelMenu`, `codeReviewMenu`), with the graph's
 * own ways around it added in their group; "Show in Branch Explorer" would lead where the user is.
 */
export function graphMenu(target: GraphTarget | null, context: GraphMenuContext): MenuEntry[] {
  const host: MenuHost = { inBranchExplorer: true, onBranchCreated: context.revealCreatedBranch };
  switch (target?.kind) {
    case 'changeset':
      return graphChangesetMenu(target.id, context, host);
    case 'branch':
      return graphBranchMenu(target.lane, context, host);
    case 'label': {
      const { label } = target;
      return withEntries(labelMenu(context.place, [labelInfo(context.layout, label, context.repository ?? '')], host), [
        menuAction('labeledChangeset', () => context.goToChangeset(label.changeset)),
      ]);
    }
    case 'codeReview':
      return graphCodeReviewMenu(target.review, context);
    case 'mergeLink':
      return groupedMenu([
        menuAction('diffMerge', () => graphActions.diffChangeset(target.link.destinationChangeset)),
        menuAction('source', () => context.goToChangeset(target.link.sourceChangeset)),
        menuAction('destination', () => context.goToChangeset(target.link.destinationChangeset)),
      ]);
    default:
      return [];
  }
}

/**
 * A review chip sits on its branch's header, so the graph names the reviewed branch from its lanes, with no command.
 * The canvas itself gives the chip's branch menu to a right-click and the context-menu key (`targetAt(..., false)`,
 * `graphKeyboard`); this one reads as the Code reviews view's wherever a chip's menu is asked for.
 */
function graphCodeReviewMenu(review: CodeReviewSummary, { place, layout, currentBranch }: GraphMenuContext): MenuEntry[] {
  const reviewed = [...layout.lanesByBranch.values()].find((lane) => lane.branch.id === review.targetBranchId)?.branch.name;
  const workspaceOn = currentBranch === undefined ? undefined : { kind: 'branch' as const, name: currentBranch };
  return codeReviewMenu(place, [reviewed === undefined ? review : { ...review, target: { kind: 'branch', branch: reviewed } }], workspaceOn);
}

function graphChangesetMenu(id: number, { place, layout, currentBranch, loadedChangeset, repository, goToChangeset }: GraphMenuContext, host: MenuHost): MenuEntry[] {
  const changeset = layout.nodes.get(id)?.changeset;
  if (!changeset) return [];
  const menu = changesetMenu({ place, loadedChangeset, loadedBranch: currentBranch, repository }, [changeset], host);
  return withEntries(menu, [layout.nodes.has(changeset.parent) && menuAction('parent', () => goToChangeset(changeset.parent))]);
}

function graphBranchMenu(lane: Lane, { place, layout, currentBranch, repository, goToChangeset, showRelatedTo }: GraphMenuContext, host: MenuHost): MenuEntry[] {
  const { branch, baseChangeset } = lane;
  const menu = branchMenu(place, [{ ...branch, repository }], currentBranch, host);
  return withEntries(menu, [
    layout.nodes.has(branch.headChangeset) && menuAction('head', () => goToChangeset(branch.headChangeset)),
    baseChangeset !== null && menuAction('base', () => goToChangeset(baseChangeset)),
    menuAction('related', () => showRelatedTo(branch.name)),
  ]);
}
