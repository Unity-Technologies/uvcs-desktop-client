import { MERGE_REQUEST_STATES, type CodeReviewSummary, type MergeRequestState } from '@shared/domain/codeReview';

/**
 * The State chip: the merge request states ticked, any mix of Draft, Open, Merged and Closed, always at least one and
 * always in `MERGE_REQUEST_STATES`' order (the way a merge request goes), so two equal picks compare equal.
 */
export type MergeRequestStates = readonly MergeRequestState[];

/** Where the State chip rests: the merge requests still to merge (`isActiveMergeRequest`). */
export const STILL_TO_MERGE: MergeRequestStates = ['Draft', 'Open'];

/** Every state ticked: the chip narrows nothing. */
export const EVERY_STATE: MergeRequestStates = MERGE_REQUEST_STATES;

/**
 * The states once `state` is ticked or unticked, in order. The last one ticked stays: a chip with none would show
 * nothing at all (`isOnlyState` disables it in the menu).
 */
export function toggledState(states: MergeRequestStates, state: MergeRequestState): MergeRequestStates {
  const ticked = states.includes(state) ? states.filter((each) => each !== state) : [...states, state];
  return ticked.length === 0 ? states : MERGE_REQUEST_STATES.filter((each) => ticked.includes(each));
}

/** Whether `state` is the only one ticked, which can't be unticked (`toggledState`). */
export function isOnlyState(states: MergeRequestStates, state: MergeRequestState): boolean {
  return states.length === 1 && states[0] === state;
}

/**
 * The chip's label: the states ticked as a sentence ("Draft or open", "Draft, open or merged"), one by its name, or
 * "Any state" with all four.
 */
export function statesChipLabel(states: MergeRequestStates): string {
  if (states.length === EVERY_STATE.length) return 'Any state';
  const words = states.map((state, index) => (index === 0 ? state : state.toLowerCase()));
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

/**
 * The state `cm find review` is asked for: only Merged alone or Closed alone, which leave the code reviews out
 * anyway (`matchesStates`). Any other pick reads with no state and narrows locally: `cm find` takes one state per
 * query, and Draft or Open alone must still keep the code reviews.
 */
export function serverStateOf(states: MergeRequestStates): MergeRequestState | undefined {
  if (states.length !== 1) return undefined;
  return states[0] === 'Merged' || states[0] === 'Closed' ? states[0] : undefined;
}

/**
 * Whether a review read shows under the State chip: a merge request in a state ticked; a code review, which has no
 * state, while Draft or Open is (it is still under way, as they are).
 */
export function matchesStates(review: Pick<CodeReviewSummary, 'mergeRequest'>, states: MergeRequestStates): boolean {
  if (review.mergeRequest) return states.includes(review.mergeRequest.state);
  return states.includes('Draft') || states.includes('Open');
}

/** The chip as it was remembered when it picked one choice (`mergeRequestState`), before it ticked states. */
const ONE_CHOICE_STATES: Record<string, MergeRequestStates> = { active: STILL_TO_MERGE, all: EVERY_STATE, merged: ['Merged'], closed: ['Closed'] };

/**
 * The states remembered, as today's: a list keeps its known states, in order; an older version's one choice
 * (`active`, `merged`, `closed`, `all`) reads as the states it showed; anything else, or nothing left, rests.
 */
export function restoredStates(remembered: unknown): MergeRequestStates {
  if (typeof remembered === 'string') return ONE_CHOICE_STATES[remembered] ?? STILL_TO_MERGE;
  if (!Array.isArray(remembered)) return STILL_TO_MERGE;
  const known = MERGE_REQUEST_STATES.filter((state) => remembered.includes(state));
  return known.length > 0 ? known : STILL_TO_MERGE;
}

/** Whether the chip has other states ticked than where it rests, which highlights it. */
export function isFilteringStates(states: MergeRequestStates): boolean {
  return states.length !== STILL_TO_MERGE.length || states.some((state, index) => state !== STILL_TO_MERGE[index]);
}
