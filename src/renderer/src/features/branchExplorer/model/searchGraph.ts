import { matchesAllWords } from '../../../lib/matchesAllWords';
import type { GraphLayout } from './layoutGraph';

/** Something a search found. A branch or label name finds the branch or label itself, not the changesets it holds. */
export type SearchHit = { kind: 'changeset'; id: number } | { kind: 'branch'; name: string } | { kind: 'label'; name: string; changeset: number };

/** What the graph lights up while a search is active; everything else fades. */
export interface SearchHighlight {
  changesets: ReadonlySet<number>;
  branches: ReadonlySet<string>;
  labels: ReadonlySet<string>;
  /** Branches holding a hit (their name, a label or a changeset): their headers stay lit while the rest fade. */
  litBranches: ReadonlySet<string>;
  active: SearchHit | null;
}

/**
 * Everything matching a search, left to right (the order Enter steps through). Branch and label names, and
 * changesets' comments and owners, match when they hold every word of the query anywhere, in any case
 * (`100874` finds /main/scm1008742). A number (`42` or `cs:42`) also finds that changeset.
 */
export function searchGraph(layout: GraphLayout, rawQuery: string): SearchHit[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const changesetNumber = exactChangesetNumber(query);
  const matches = (text: string): boolean => matchesAllWords(text, query);
  // Within a column: the branch header first, then the labels above the changeset, then the changeset.
  const found: { hit: SearchHit; column: number; order: number }[] = [];
  for (const lane of layout.lanes) {
    if (matches(lane.branch.name)) found.push({ hit: { kind: 'branch', name: lane.branch.name }, column: lane.firstOwnColumn ?? lane.startColumn, order: 0 });
  }
  for (const { changeset, column } of layout.nodesByColumn) {
    for (const label of layout.labelsByChangeset.get(changeset.id) ?? []) {
      if (matches(label.name)) found.push({ hit: { kind: 'label', name: label.name, changeset: changeset.id }, column, order: 1 });
    }
    if (changeset.id === changesetNumber || matches(`${changeset.comment}\n${changeset.owner}`)) {
      found.push({ hit: { kind: 'changeset', id: changeset.id }, column, order: 2 });
    }
  }
  return found.sort((a, b) => a.column - b.column || a.order - b.order).map(({ hit }) => hit);
}

/** Where the first Enter lands: on the changeset a number names, wherever it is among the hits, otherwise on the first. */
export function firstHitIndex(hits: readonly SearchHit[], rawQuery: string): number {
  const changesetNumber = exactChangesetNumber(rawQuery.trim());
  return Math.max(0, hits.findIndex((hit) => hit.kind === 'changeset' && hit.id === changesetNumber));
}

function exactChangesetNumber(query: string): number | undefined {
  const number = /^(?:cs:)?(\d+)$/i.exec(query)?.[1];
  return number === undefined ? undefined : Number(number);
}

export function searchHighlight(layout: GraphLayout, hits: readonly SearchHit[], active: SearchHit | null): SearchHighlight {
  const changesets = new Set<number>();
  const branches = new Set<string>();
  const labels = new Set<string>();
  const litBranches = new Set<string>();
  for (const hit of hits) {
    if (hit.kind === 'branch') {
      branches.add(hit.name);
      litBranches.add(hit.name);
      continue;
    }
    if (hit.kind === 'changeset') changesets.add(hit.id);
    else labels.add(hit.name);
    const branch = layout.nodes.get(hit.kind === 'changeset' ? hit.id : hit.changeset)?.changeset.branch;
    if (branch !== undefined) litBranches.add(branch);
  }
  return { changesets, branches, labels, litBranches, active };
}

/** A stable identity for a hit, e.g. to replay the arrival animation only when the current hit changes. */
export function hitKey(hit: SearchHit): string {
  return hit.kind === 'changeset' ? `changeset:${hit.id}` : `${hit.kind}:${hit.name}`;
}
