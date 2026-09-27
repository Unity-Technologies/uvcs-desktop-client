import type { StatusTone } from '../../components/StatusBadge';
import type { Icon, MenuEntry } from '../../lib/actions';
import { pluralize } from '../../lib/text';
import type { SectionId } from './paletteScope';

export interface SearchResult {
  /** Unique across all groups. */
  id: string;
  icon: Icon;
  label: string;
  /** The label is a branch name: its parent branches are dimmed and give way before its leaf. */
  labelIsBranch?: boolean;
  /** Dimmed after the label, e.g. a file's folder or who made a changeset and when. */
  detail?: string;
  shortcut?: string;
  /** Fuzzy-matched character positions to highlight; without them, the words of the query are highlighted. */
  labelMatches?: number[];
  detailMatches?: number[];
  /** How well it matches, from 0 to 1 (see `fuzzyMatchQuality`). Actions such as "search for more" have none. */
  quality?: number;
  /** A file's pending change, shown as its status letter. */
  status?: { tone: StatusTone; title: string };
  /** The branch the workspace is on. */
  isCurrent?: boolean;
  /** Everything else that can be done with it (Tab), the same menu it has in its own view. */
  menu?: () => MenuEntry[];
  run: () => void;
  /** Runs without closing the palette, e.g. to search for more. */
  keepOpen?: boolean;
  /** Stays visible in a collapsed section, e.g. "search all changesets" after the matches. */
  pinned?: boolean;
  /** Spins the icon while something is in progress. */
  busy?: boolean;
  disabled?: boolean;
}

export interface SearchGroup {
  section: SectionId;
  heading: string;
  results: SearchResult[];
}

export interface ShownGroup extends SearchGroup {
  /** Results held back until the section is expanded ("N more"). */
  more: number;
}

/** Rows a section shows until it is expanded, so every kind of thing fits on screen at once. */
export const COLLAPSED_ROWS = 5;

/** Caps every section not in `expanded` at `COLLAPSED_ROWS`, plus its pinned results. */
export function collapseGroups(groups: SearchGroup[], expanded: ReadonlySet<SectionId> | 'all'): ShownGroup[] {
  return groups.map((group) => {
    if (expanded === 'all' || expanded.has(group.section)) return { ...group, more: 0 };
    const unpinned = group.results.filter((result) => !result.pinned);
    const results = [...unpinned.slice(0, COLLAPSED_ROWS), ...group.results.filter((result) => result.pinned)];
    return { ...group, results, more: group.results.length - results.length };
  });
}

/** The row that expands a collapsed section, in the heading's words: "1 more branch", "3 more pending changes". */
export function moreLabel({ heading, more }: Pick<ShownGroup, 'heading' | 'more'>): string {
  const plural = heading.toLowerCase();
  const singular = plural.endsWith('ches') ? plural.slice(0, -2) : plural.slice(0, -1);
  return pluralize(more, `more ${singular}`, `more ${plural}`);
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
