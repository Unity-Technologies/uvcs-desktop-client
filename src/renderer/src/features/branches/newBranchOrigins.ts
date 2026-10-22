import type { OptionCard } from '../../ui/OptionCards';

/** Where a new branch can start, as the new-branch dialog offers it. */
export interface NewBranchOrigin {
  /** The branch the new one hangs from, e.g. `/main`. */
  parentBranch: string;
  /** Where it starts: `cs:12` or `lb:v1`. */
  startingPoint: string;
  /** How to describe the starting point to the user, e.g. "changeset 12". */
  startingPointLabel: string;
  /** How it reads as one of several cards in "Start from" (`StartingPointPicker`). */
  card?: { title: string; description: string };
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
