import type { GraphLayout } from './layoutGraph';

/**
 * Changesets matching a search, left to right. Matches changeset numbers (`42` or `cs:42`),
 * comments, owners, branch names (their changesets) and label names.
 */
export function searchGraph(layout: GraphLayout, rawQuery: string): number[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const changesetNumber = /^(?:cs:)?(\d+)$/.exec(query)?.[1];
  return layout.nodesByColumn
    .filter(({ changeset }) => {
      if (changesetNumber !== undefined) return String(changeset.id) === changesetNumber;
      const labels = layout.labelsByChangeset.get(changeset.id) ?? [];
      return (
        changeset.comment.toLowerCase().includes(query) ||
        changeset.owner.toLowerCase().includes(query) ||
        changeset.branch.toLowerCase().includes(query) ||
        labels.some((label) => label.name.toLowerCase().includes(query))
      );
    })
    .map(({ changeset }) => changeset.id);
}
