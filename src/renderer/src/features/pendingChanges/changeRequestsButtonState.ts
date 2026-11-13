import type { ReviewChangeRequest } from '../codeReviews/changeRequests/changeRequests';

/** The description's change requests button: how many it offers, its tooltip, and its name for a screen reader. */
export interface ChangeRequestsButton {
  count: number;
  tip: string;
  label: string;
}

/**
 * The check-in's door to the change requests it can apply (docs/features/code-reviews.md "Applying change requests"):
 * a small button in the description's footer with their count, there only while some are offered (the open ones its
 * comment doesn't name yet, `notYetNamed`), so the description is as it always was otherwise.
 */
export function changeRequestsButton(offered: readonly ReviewChangeRequest[]): ChangeRequestsButton | null {
  const count = offered.length;
  if (count === 0) return null;
  return { count, tip: 'Change requests to apply', label: `${count} change ${count === 1 ? 'request' : 'requests'} to apply` };
}
