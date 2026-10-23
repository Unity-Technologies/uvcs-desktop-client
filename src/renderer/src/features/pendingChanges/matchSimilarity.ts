import type { MovePair, MoveSimilarity, PendingChange } from '@shared/domain/pendingChanges';
import { searchedCandidates, type MatchSide } from './moveMatches';

/**
 * Search matches' similarity: how alike the change and each candidate are (`api.pendingChanges.moveSimilarities`, as
 * `cm`'s move detection measures it), shown on each row and filtered by a minimum the dialog's slider sets.
 */

/** A candidate and how alike it is to the change, from 0 to 1; null where it can't be told, or isn't measured yet. */
export interface ScoredCandidate {
  candidate: PendingChange;
  similarity: number | null;
}

/**
 * The slider starts with every candidate shown: what is left to pair by hand is mostly what the move detection found
 * too unlike (under Settings' 20% by default).
 */
export const DEFAULT_MINIMUM_SIMILARITY = 0;

/** Only files are scored: `cm` scores a folder by its entries once its files are paired, which a pick by hand isn't. */
export function isScored(change: PendingChange): boolean {
  return change.itemType !== 'directory';
}

/** The pairs to measure, the deleted file first whichever side the change is, in the candidates' order. */
export function movePairsOf(change: PendingChange, candidates: readonly PendingChange[], side: MatchSide): MovePair[] {
  return candidates.map(({ path }) => (side === 'deleted' ? { deleted: change.path, added: path } : { deleted: path, added: change.path }));
}

/**
 * The rows: without similarities (a folder, or while unknown), the candidates as they are. With them, those `cm` would
 * pair at least `minimumPercent` alike, the most alike first, then those it couldn't measure, last; equal ones keep
 * the candidates' order (`compareCandidates`).
 */
export function scoredCandidates(candidates: readonly PendingChange[], similarities: readonly MoveSimilarity[] | undefined, minimumPercent: number): ScoredCandidate[] {
  if (!similarities) return candidates.map((candidate) => ({ candidate, similarity: null }));
  const minimum = minimumPercent / 100;
  const rows: ScoredCandidate[] = [];
  candidates.forEach((candidate, index) => {
    const similarity = similarities[index] ?? 'notMeasured';
    if (similarity === 'notPairable' || (typeof similarity === 'number' && similarity < minimum)) return;
    rows.push({ candidate, similarity: typeof similarity === 'number' ? similarity : null });
  });
  return rows.sort((a, b) => (b.similarity ?? -1) - (a.similarity ?? -1));
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
