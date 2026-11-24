import type { Changeset } from '@shared/domain/changeset';
import type { DiffTarget } from '@shared/domain/diff';
import { listNames, pluralize } from '../../lib/text';
import { displayName, sameUser } from '../../lib/userName';

/**
 * What the list's selection shows beside it: every changeset combined (the place's own diff: a branch's, the whole
 * update), one changeset's diff, that of a span of them (several selected), or nothing yet, while a span asked for
 * waits for the changesets that tell where it starts.
 */
export type ChangesetListChoice =
  | { kind: 'all' }
  | { kind: 'reading' }
  | { kind: 'changeset'; changesetId: number }
  | { kind: 'span'; target: Extract<DiffTarget, { kind: 'range' }>; changesets: Changeset[] };

/**
 * `changesets`: the list's, newest first, undefined while read; `selectedIds`: the changesets selected
 * (`selectedChangesetIds`), none for the combined row. Several selected show as one diff, from the oldest one's parent
 * to the newest (`cm diff cs:A cs:B`): the span between them, every changeset in it.
 */
export function changesetListChoice(changesets: readonly Changeset[] | undefined, selectedIds: readonly number[]): ChangesetListChoice {
  if (selectedIds.length === 0) return { kind: 'all' };
  if (!changesets) return selectedIds.length === 1 ? { kind: 'changeset', changesetId: selectedIds[0]! } : { kind: 'reading' };
  const selected = new Set(selectedIds);
  const places = changesets.flatMap((changeset, index) => (selected.has(changeset.id) ? [index] : []));
  if (places.length > 1) {
    const span = changesets.slice(Math.min(...places), Math.max(...places) + 1);
    const newest = span[0]!;
    const oldest = span.at(-1)!;
    return { kind: 'span', target: { kind: 'range', fromSpec: `cs:${oldest.parent}`, toSpec: `cs:${newest.id}` }, changesets: span };
  }
  if (places.length === 1) return { kind: 'changeset', changesetId: changesets[places[0]!]!.id };
  // Not in the list (still another branch's while the branch's own are read): one changeset is still shown by its
  // number; a span can't tell where it starts, so everything combined shows.
  return selectedIds.length === 1 ? { kind: 'changeset', changesetId: selectedIds[0]! } : { kind: 'all' };
}

/** A span of changesets in a line, where one changeset's summary sits: "3 changesets · cs:15 to cs:17 · Daniel". */
export interface ChangesetSpanSummary {
  count: string;
  ends: string;
  authors: string;
}

/** `span`: newest first, as the choice holds it. The authors as they first checked in, each once. */
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
