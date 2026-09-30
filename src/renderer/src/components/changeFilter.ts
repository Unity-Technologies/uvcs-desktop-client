import { matchesWordFilter } from '../lib/matchesAllWords';
import { pluralize } from '../lib/text';
import type { StatusTone } from './StatusBadge';

export interface ChangeFilter {
  query: string;
  /** Empty means every status. */
  tones: ReadonlySet<StatusTone>;
}

// The order the Plastic desktop GUI lists change categories in.
const TONE_ORDER: StatusTone[] = ['changed', 'moved', 'deleted', 'permissions', 'added', 'private', 'conflict', 'muted'];
const ALWAYS_OFFERED: ReadonlySet<StatusTone> = new Set(['added', 'changed', 'deleted', 'moved']);

/** Orders changes by status the way the filter chips are laid out: changed, moved, deleted, …, private. */
export function compareTones(a: StatusTone, b: StatusTone): number {
  return TONE_ORDER.indexOf(a) - TONE_ORDER.indexOf(b);
}

/** The status chips to offer: the common ones always, the rest only while some change has them. */
export function offeredTones(present: ReadonlySet<StatusTone>): StatusTone[] {
  return TONE_ORDER.filter((tone) => ALWAYS_OFFERED.has(tone) || present.has(tone));
}

/** How many changes have each status, for the chips' tooltips and to dim the empty ones. */
export function countTones(tones: readonly StatusTone[]): Map<StatusTone, number> {
  const counts = new Map<StatusTone, number>();
  for (const tone of tones) counts.set(tone, (counts.get(tone) ?? 0) + 1);
  return counts;
}

/** The filter field's placeholder: "Filter 1 file", "Filter 1,204 files". */
export function changeFilterPlaceholder(count: number): string {
  return `Filter ${pluralize(count, 'file')}`;
}

export function matchesChangeFilter(path: string, tone: StatusTone, { query, tones }: ChangeFilter): boolean {
  return (tones.size === 0 || tones.has(tone)) && matchesWordFilter([path], query);
}
