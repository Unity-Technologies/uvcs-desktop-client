import type { GraphLayout } from './layoutGraph';
import { typedChangesetNumber } from '../../../lib/changesetNumber';
import { queryWords } from '../../../lib/matchesAllWords';
import { changesetMatcher, nameMatcher, narrows } from './searchWords';

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

/** A search already run, which a narrower one can start from. */
export interface GraphSearchResult {
  query: string;
  hits: readonly SearchHit[];
}

/**
 * Everything matching a search, left to right (the order Enter steps through). Branch and label names, and
 * changesets' comments and owners, match when they hold every word of the query anywhere, in any case
 * (`100874` finds /main/task1008742). A number (`42` or `cs:42`) also finds that changeset.
 * Given the previous search of the same layout, a query that narrows it (typing on) only looks at the changesets
 * that one found.
 */
export function searchGraph(layout: GraphLayout, rawQuery: string, previous?: GraphSearchResult | null): SearchHit[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const changesetNumber = typedChangesetNumber(query);
  const words = queryWords(query);
  const matches = nameMatcher(words);
  const matchesChangeset = changesetMatcher(words);

  // Left to right; within a column the branch header first, then the labels above the changeset, then the changeset.
  // Changesets are found in column order: the branches and labels found are sorted, then merged in.
  const named: { hit: SearchHit; column: number; order: number }[] = [];
  for (const lane of layout.lanes) {
    if (matches(lane.branch.name)) named.push({ hit: { kind: 'branch', name: lane.branch.name }, column: lane.firstOwnColumn ?? lane.startColumn, order: 0 });
  }
  for (const [changeset, labels] of layout.labelsByChangeset) {
    const column = layout.nodes.get(changeset)!.column;
    for (const label of labels) if (matches(label.name)) named.push({ hit: { kind: 'label', name: label.name, changeset }, column, order: 1 });
  }
  named.sort((a, b) => a.column - b.column || a.order - b.order);

  // A number finds its changeset whatever the text says, so it never narrows.
  const candidates =
    previous && changesetNumber === undefined && narrows(previous.query, query)
      ? previous.hits.flatMap((hit) => (hit.kind === 'changeset' ? [layout.nodes.get(hit.id)!] : []))
      : layout.nodesByColumn;
  const found: SearchHit[] = [];
  let nextNamed = 0;
  for (const { changeset, column } of candidates) {
    while (nextNamed < named.length && named[nextNamed]!.column <= column) found.push(named[nextNamed++]!.hit);
    if (changeset.id === changesetNumber || matchesChangeset(changeset.comment, changeset.owner)) found.push({ kind: 'changeset', id: changeset.id });
  }
  while (nextNamed < named.length) found.push(named[nextNamed++]!.hit);
  return found;
}

/** Where the first Enter lands: on the changeset a number names, wherever it is among the hits, otherwise on the first. */
export function firstHitIndex(hits: readonly SearchHit[], rawQuery: string): number {
  const changesetNumber = typedChangesetNumber(rawQuery);
  return Math.max(0, hits.findIndex((hit) => hit.kind === 'changeset' && hit.id === changesetNumber));
}

/**
 * Where Enter (`1`) or Shift+Enter (`-1`) goes among the hits, round from one end to the other. `activeIndex` is -1
 * until the user steps: then going forward lands per `firstHitIndex`, going back on the last hit.
 */
export function steppedHitIndex(activeIndex: number, direction: 1 | -1, hits: readonly SearchHit[], rawQuery: string): number {
  if (activeIndex === -1) return direction === 1 ? firstHitIndex(hits, rawQuery) : hits.length - 1;
  return (activeIndex + direction + hits.length) % hits.length;
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
