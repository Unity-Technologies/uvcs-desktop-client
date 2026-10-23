import type { OptionCard } from '../../ui/OptionCards';

/** Where a new branch can start, as the new-branch dialog offers it. */
export interface NewBranchOrigin {
  /** The branch the new one hangs from, e.g. `/main`. */
  parentBranch: string;
  /** Where it starts: `cs:12` or `lb:v1`. */
  startingPoint: string;
  /** How to describe the starting point to the user, e.g. "changeset 12". */
  startingPointLabel: string;
  /**
   * How it reads as one of several in "Start from" (`StartingPointPicker`): its card, and `name`, short, on the
   * picker's button once chosen ("main", "task001", "label v1").
   */
  card?: { name: string; title: string; description: string };
}

/** What "Start from"'s button shows for the chosen starting point: its short name, its card's title in the tooltip. */
export function chosenStartingPoint(origin: NewBranchOrigin): { name: string; title: string } {
  return { name: origin.card?.name ?? origin.startingPointLabel, title: origin.card?.title ?? origin.startingPointLabel };
}

/**
 * The cards "Start from" offers, valued by the origin's index; null with a single origin, when there is nothing to
 * choose and the dialog shows no "Start from".
 */
export function startingPointCards(origins: NewBranchOrigin[]): OptionCard<string>[] | null {
  if (origins.length < 2) return null;
  return origins.map((origin, index) => ({
    value: String(index),
    title: origin.card?.title ?? origin.startingPointLabel,
    description: origin.card?.description ?? '',
  }));
}

/**
 * Where the Branches view's New branch starts: the selected branch's head, else what the workspace has loaded; with
 * neither (a repository explored without a workspace, nothing selected) it waits for a branch to be selected.
 */
export function newBranchStart(hasSelectedBranch: boolean, inWorkspace: boolean): 'selectedBranch' | 'workspace' | null {
  if (hasSelectedBranch) return 'selectedBranch';
  return inWorkspace ? 'workspace' : null;
}
