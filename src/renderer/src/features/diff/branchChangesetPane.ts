import type { Changeset } from '@shared/domain/changeset';
import type { DiffTarget } from '@shared/domain/diff';
import { listNames, pluralize } from '../../lib/text';
import { displayName, sameUser } from '../../lib/userName';

/**
 * What a branch diff's "Changeset by changeset" mode shows beside its list: nothing while the changesets are read,
 * that the branch has none, the diff of one changeset, or that of a span of them, several selected.
 */
export type BranchChangesetPane =
  | { kind: 'reading' }
  | { kind: 'noChangesets' }
  | { kind: 'changeset'; changesetId: number }
  | { kind: 'span'; target: Extract<DiffTarget, { kind: 'range' }>; changesets: Changeset[] };

/**
 * `changesets`: the branch's, newest first, undefined while read; `selectedIds`: the changesets selected in the list.
 * Until the list selects one (it selects the newest once they're read), the newest shows: the branch has changesets.
 * Several selected show as one diff, from the oldest one's parent to the newest (`cm diff cs:A cs:B`): the span between
 * them, every changeset in it, also those left out of a selection made apart.
 */
export function branchChangesetPane(changesets: readonly Changeset[] | undefined, selectedIds: readonly number[]): BranchChangesetPane {
  if (!changesets) return { kind: 'reading' };
  const selected = new Set(selectedIds);
  const places = changesets.flatMap((changeset, index) => (selected.has(changeset.id) ? [index] : []));
  if (places.length > 1) {
    const span = changesets.slice(Math.min(...places), Math.max(...places) + 1);
    const newest = span[0]!;
    const oldest = span.at(-1)!;
    return { kind: 'span', target: { kind: 'range', fromSpec: `cs:${oldest.parent}`, toSpec: `cs:${newest.id}` }, changesets: span };
  }
  const shownId = places.length === 1 ? changesets[places[0]!]!.id : (selectedIds[0] ?? changesets[0]?.id);
  return shownId === undefined ? { kind: 'noChangesets' } : { kind: 'changeset', changesetId: shownId };
}

/** A span of changesets in a line, where one changeset's summary sits: "3 changesets · cs:15 to cs:17 · Daniel". */
export interface ChangesetSpanSummary {
  count: string;
  ends: string;
  authors: string;
}

/** `span`: newest first, as the pane holds it. The authors as they first checked in, each once. */
export function changesetSpanSummary(span: readonly Changeset[]): ChangesetSpanSummary {
  const oldestFirst = [...span].reverse();
  const authors: string[] = [];
  for (const { owner } of oldestFirst) if (!authors.some((author) => sameUser(author, owner))) authors.push(owner);
  return {
    count: pluralize(span.length, 'changeset'),
    ends: `cs:${oldestFirst[0]?.id} to cs:${span[0]?.id}`,
    authors: listNames(authors.map(displayName)),
  };
}
