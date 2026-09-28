import type { MenuEntry } from '../../lib/actions';
import { groupedMenu, withEntries } from '../../lib/menuGroups';
import { menuAction, type MenuPlace } from '../../components/menuWords';
import { branchMenu } from '../branches/branchMenu';
import { changesetMenu } from '../changesets/changesetMenu';
import { codeReviewMenu } from '../codeReviews/codeReviewMenu';
import { labelMenu } from '../labels/labelMenu';
import type { GraphTarget } from './canvas/graphTargets';
import { graphActions } from './graphActions';
import type { GraphLayout, Lane } from './model/layoutGraph';

interface GraphMenuContext {
  workspacePath: string;
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
  const place: MenuPlace = { inBranchExplorer: true, onBranchCreated: context.revealCreatedBranch };
  switch (target?.kind) {
    case 'changeset':
      return graphChangesetMenu(target.id, context, place);
    case 'branch':
      return graphBranchMenu(target.lane, context, place);
    case 'label': {
      const { label } = target;
      const branch = context.layout.nodes.get(label.changeset)?.changeset.branch ?? '';
      return withEntries(labelMenu(context.workspacePath, [{ ...label, branch, repository: context.repository ?? '' }], place), [
        menuAction('labeledChangeset', () => context.goToChangeset(label.changeset)),
      ]);
    }
    case 'codeReview':
      return codeReviewMenu(context.workspacePath, [target.review]);
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

function graphChangesetMenu(id: number, { workspacePath, layout, currentBranch, loadedChangeset, repository, goToChangeset }: GraphMenuContext, place: MenuPlace): MenuEntry[] {
  const changeset = layout.nodes.get(id)?.changeset;
  if (!changeset) return [];
  const menu = changesetMenu({ workspacePath, loadedChangeset, loadedBranch: currentBranch, repository }, [changeset], place);
  return withEntries(menu, [layout.nodes.has(changeset.parent) && menuAction('parent', () => goToChangeset(changeset.parent))]);
}

function graphBranchMenu(lane: Lane, { workspacePath, layout, currentBranch, repository, goToChangeset, showRelatedTo }: GraphMenuContext, place: MenuPlace): MenuEntry[] {
  const { branch, baseChangeset } = lane;
  const menu = branchMenu(workspacePath, [{ ...branch, repository }], currentBranch, place);
  return withEntries(menu, [
    layout.nodes.has(branch.headChangeset) && menuAction('head', () => goToChangeset(branch.headChangeset)),
    baseChangeset !== null && menuAction('base', () => goToChangeset(baseChangeset)),
    menuAction('related', () => showRelatedTo(branch.name)),
  ]);
}
