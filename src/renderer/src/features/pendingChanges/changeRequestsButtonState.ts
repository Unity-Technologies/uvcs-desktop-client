import type { BranchChangeRequests } from '../codeReviews/changeRequests/useChangeRequests';

/** The check-in's change requests button: how many it offers, its tooltip, and its name for a screen reader. */
export interface ChangeRequestsButton {
  count: number;
  tip: string;
  label: string;
}

/**
 * The check-in's door to the change requests it can apply (docs/features/code-reviews.md "Applying change requests"):
 * a small button beside Recent comments with their count, shown only while the workspace's branch has some open. Nothing
 * while they're read or couldn't be: a button that comes and goes says nothing a check-in needs.
 */
export function changeRequestsButton({ requests }: BranchChangeRequests): ChangeRequestsButton | null {
  const count = requests.length;
  if (count === 0) return null;
  return { count, tip: 'Change requests to apply', label: `${count} change ${count === 1 ? 'request' : 'requests'} to apply` };
}
