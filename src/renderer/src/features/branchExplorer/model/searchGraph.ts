import type { GraphLayout } from './layoutGraph';

/** Something a search found. A branch or label name finds the branch or label itself, not the changesets it holds. */
export type SearchHit = { kind: 'changeset'; id: number } | { kind: 'branch'; name: string } | { kind: 'label'; name: string; changeset: number };

/** What the graph lights up while a search is active; everything else fades. */
export interface SearchHighlight {
  changesets: ReadonlySet<number>;
  branches: ReadonlySet<string>;
  labels: ReadonlySet<string>;
  active: SearchHit | null;
}

/**
 * Everything matching a search, left to right (the order Enter steps through). Changesets match by
 * number (`42` or `cs:42`), comment or owner; branches and labels by name.
 */
export function searchGraph(layout: GraphLayout, rawQuery: string): SearchHit[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const changesetNumber = /^(?:cs:)?(\d+)$/.exec(query)?.[1];
  if (changesetNumber !== undefined) {
    return layout.nodes.has(Number(changesetNumber)) ? [{ kind: 'changeset', id: Number(changesetNumber) }] : [];
  }

  const matches = (text: string): boolean => text.toLowerCase().includes(query);
  // Within a column: the branch header first, then the labels above the changeset, then the changeset.
  const found: { hit: SearchHit; column: number; order: number }[] = [];
  for (const lane of layout.lanes) {
    if (matches(lane.branch.name)) found.push({ hit: { kind: 'branch', name: lane.branch.name }, column: lane.firstOwnColumn ?? lane.startColumn, order: 0 });
  }
  for (const { changeset, column } of layout.nodesByColumn) {
    for (const label of layout.labelsByChangeset.get(changeset.id) ?? []) {
      if (matches(label.name)) found.push({ hit: { kind: 'label', name: label.name, changeset: changeset.id }, column, order: 1 });
    }
    if (matches(changeset.comment) || matches(changeset.owner)) found.push({ hit: { kind: 'changeset', id: changeset.id }, column, order: 2 });
  }
  return found.sort((a, b) => a.column - b.column || a.order - b.order).map(({ hit }) => hit);
}

export function searchHighlight(hits: readonly SearchHit[], active: SearchHit | null): SearchHighlight {
  const changesets = new Set<number>();
  const branches = new Set<string>();
  const labels = new Set<string>();
  for (const hit of hits) {
    if (hit.kind === 'changeset') changesets.add(hit.id);
    else if (hit.kind === 'branch') branches.add(hit.name);
    else labels.add(hit.name);
  }
  return { changesets, branches, labels, active };
}

/** A stable identity for a hit, e.g. to replay the arrival animation only when the current hit changes. */
export function hitKey(hit: SearchHit): string {
  return hit.kind === 'changeset' ? `changeset:${hit.id}` : `${hit.kind}:${hit.name}`;
}
