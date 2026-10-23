import type { MovePair, MoveSimilarity, PendingChange } from '@shared/domain/pendingChanges';
import { queryOptions } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';
import { searchedCandidates, type MatchCandidate, type MatchSide } from './moveMatches';

/**
 * Search matches' similarity: how alike the change and each candidate are (`api.pendingChanges.moveSimilarities`, as
 * `cm`'s move detection measures it), shown on each row and filtered by a minimum the dialog's slider sets.
 */

/** A candidate and how alike it is to the change, from 0 to 1; null where it can't be told, or isn't measured yet. */
export interface ScoredCandidate {
  candidate: MatchCandidate;
  /** From 0 to 1; null where it couldn't be measured; undefined while it isn't measured (yet, or for a folder). */
  similarity: number | null | undefined;
}

/** What shows under the search: the slider, the word that measuring failed in its place, or nothing. */
export type MinimumNote = 'slider' | 'notMeasured' | null;

/** Where the slider starts: the official client's Search matches starts at 80% (`DEFAULT_SIMILARITY_VALUE`). */
export const DEFAULT_MINIMUM_SIMILARITY = 80;

/**
 * The measure's query key: an area of its own, which no refresh scope names (`refreshScopes`).
 */
export function moveSimilaritiesKey(workspacePath: string, path: string) {
  return queryKeys.inWorkspace(workspacePath, 'moveSimilarities', path);
}

/**
 * The measure, once per dialog. The candidates are fixed as the dialog opens, so nothing that happens meanwhile can
 * change the answer, and measuring again costs a `cm ls`, the deleted files' `cm cat`s and a read of every new file:
 * no refresh reaches it, not even one of the whole workspace (`IMMUTABLE_QUERY`: the Refresh button, a loaded
 * changeset that moved). The slider filters what was measured; it is let go as the dialog closes (`gcTime: 0`).
 */
export function moveSimilaritiesQuery(workspacePath: string, change: PendingChange, candidates: readonly MatchCandidate[], side: MatchSide) {
  return queryOptions({
    queryKey: moveSimilaritiesKey(workspacePath, change.path),
    queryFn: () => api.pendingChanges.moveSimilarities(workspacePath, movePairsOf(change, candidates, side)),
    meta: IMMUTABLE_QUERY,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
}

/** Only files are scored: `cm` scores a folder by its entries once its files are paired, which a pick by hand isn't. */
export function isScored(change: PendingChange): boolean {
  return change.itemType !== 'directory';
}

/** The pairs to measure, the deleted file first whichever side the change is, in the candidates' order. */
export function movePairsOf(change: PendingChange, candidates: readonly MatchCandidate[], side: MatchSide): MovePair[] {
  return candidates.map(({ path }) => (side === 'deleted' ? { deleted: change.path, added: path } : { deleted: path, added: change.path }));
}

/**
 * The rows: without similarities (a folder, or while unknown), the candidates as they are. With them, those `cm` would
 * pair at least `minimumPercent` alike, the most alike first, then those it couldn't measure, last; equal ones keep
 * the candidates' order (`compareCandidates`).
 */
export function scoredCandidates(candidates: readonly MatchCandidate[], similarities: readonly MoveSimilarity[] | undefined, minimumPercent: number): ScoredCandidate[] {
  if (!similarities) return candidates.map((candidate) => ({ candidate, similarity: undefined }));
  const minimum = minimumPercent / 100;
  const rows: ScoredCandidate[] = [];
  candidates.forEach((candidate, index) => {
    const similarity = similarities[index] ?? 'notMeasured';
    if (similarity === 'notPairable' || (typeof similarity === 'number' && similarity < minimum)) return;
    rows.push({ candidate, similarity: typeof similarity === 'number' ? similarity : null });
  });
  return rows.sort((a, b) => (b.similarity ?? -1) - (a.similarity ?? -1));
}

/** How many candidates `cm` would pair with the change; undefined while unknown. */
export function pairableCount(similarities: readonly MoveSimilarity[] | undefined): number | undefined {
  return similarities?.filter((similarity) => similarity !== 'notPairable').length;
}

/** Whether the dialog measures its candidates: only files are, and only when there are some. */
export function isMeasured(change: PendingChange, candidates: number): boolean {
  return isScored(change) && candidates > 0;
}

/**
 * The note under the search: that measuring failed, or the slider for measured candidates, until it is known none of
 * them pairs (then it could do nothing).
 */
export function minimumNoteOf({ change, candidates, pairable, failed }: { change: PendingChange; candidates: number; pairable: number | undefined; failed: boolean }): MinimumNote {
  if (failed) return 'notMeasured';
  return isMeasured(change, candidates) && pairable !== 0 ? 'slider' : null;
}

/** The rows the dialog's search leaves, in their order (`searchedCandidates`). */
export function searchedRows(rows: readonly ScoredCandidate[], search: string): readonly ScoredCandidate[] {
  const kept = new Set(searchedCandidates(rows.map((row) => row.candidate), search));
  return kept.size === rows.length ? rows : rows.filter((row) => kept.has(row.candidate));
}

/** "64%", rounded down so 99.6% never reads as identical; a dash where it couldn't be told. */
export function similarityLabel(similarity: number | null): string {
  // 0.29 * 100 is 28.999…: a hair over is still the whole percentage it reads as.
  return similarity === null ? '–' : `${Math.floor(similarity * 100 + 1e-9)}%`;
}

/** The label's tooltip: what the number measures, or why there is none. */
export function similarityTip(similarity: number | null): string {
  return similarity === null ? 'Not measured: too large or unreadable' : 'Lines alike for text, size for a binary file';
}
