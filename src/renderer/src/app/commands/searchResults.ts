import type { Icon } from '../../lib/actions';

export interface SearchResult {
  /** Unique across all groups. */
  id: string;
  icon: Icon;
  label: string;
  detail?: string;
  shortcut?: string;
  /** Fuzzy-matched character positions to highlight; without them, the words of the query are highlighted. */
  labelMatches?: number[];
  detailMatches?: number[];
  /** How well it matches, from 0 to 1 (see `fuzzyMatchQuality`). Actions such as "search for more" have none. */
  quality?: number;
  run: () => void;
  /** Runs without closing the palette, e.g. to search for more. */
  keepOpen?: boolean;
  /** Spins the icon while something is in progress. */
  busy?: boolean;
  disabled?: boolean;
}

export interface SearchGroup {
  heading: string;
  results: SearchResult[];
}

/** From here on a match is clearly what was meant, so much weaker matches elsewhere would only be noise. */
const STRONG_MATCH = 0.7;
/** How far below the best match a result may score and still be shown, once the best one is strong. */
const MAX_DISTANCE_FROM_BEST = 0.4;

/**
 * Puts the groups with the best matches first, whatever their kind, and each group's best matches first.
 * When something matches strongly, much weaker matches are dropped; when nothing does, they are all there is, so they stay.
 */
export function rankGroups(groups: SearchGroup[]): SearchGroup[] {
  const best = Math.max(0, ...groups.flatMap((group) => group.results.map(qualityOf)));
  const keep = (result: SearchResult): boolean =>
    result.quality === undefined || best < STRONG_MATCH || result.quality >= best - MAX_DISTANCE_FROM_BEST;

  return groups
    .map((group) => ({ ...group, results: sortByQuality(group.results.filter(keep)) }))
    .filter((group) => group.results.length > 0)
    .map((group, order) => ({ group, order, best: Math.max(...group.results.map(qualityOf)) }))
    .sort((a, b) => b.best - a.best || a.order - b.order)
    .map(({ group }) => group);
}

/** Stable, and actions keep their place after the matches. */
function sortByQuality(results: SearchResult[]): SearchResult[] {
  return results
    .map((result, order) => ({ result, order }))
    .sort((a, b) => (a.result.quality === undefined || b.result.quality === undefined ? a.order - b.order : b.result.quality - a.result.quality || a.order - b.order))
    .map(({ result }) => result);
}

function qualityOf(result: SearchResult): number {
  return result.quality ?? 0;
}
