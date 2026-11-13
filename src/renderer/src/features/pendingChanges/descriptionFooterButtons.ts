/** A button of the check-in description's footer: Recent comments, or the change requests to apply with their count. */
export type DescriptionFooterButton = { kind: 'recentComments'; tip: string } | { kind: 'changeRequests'; tip: string; count: number; label: string };

/**
 * The check-in description's footer (docs/features/changes.md "The check-in's comment"), quiet icons as GitHub Desktop
 * draws its own: Recent comments while there are some, then the change requests to apply while some are offered (the
 * open ones the comment doesn't name yet, `notYetNamed`), with their count. None at all: no footer, and the description
 * is as it always was.
 */
export function descriptionFooterButtons({ recentComments, changeRequests }: { recentComments: number; changeRequests: number }): DescriptionFooterButton[] {
  return [
    ...(recentComments > 0 ? [{ kind: 'recentComments' as const, tip: 'Recent comments' }] : []),
    ...(changeRequests > 0
      ? [{ kind: 'changeRequests' as const, tip: 'Change requests to apply', count: changeRequests, label: `${changeRequests} change ${changeRequests === 1 ? 'request' : 'requests'} to apply` }]
      : []),
  ];
}
