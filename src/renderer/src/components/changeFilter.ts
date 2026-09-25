import type { StatusTone } from './StatusBadge';

export interface ChangeFilter {
  query: string;
  /** Empty means every status. */
  tones: ReadonlySet<StatusTone>;
}

// The order the Plastic desktop GUI lists change categories in.
const TONE_ORDER: StatusTone[] = ['changed', 'moved', 'deleted', 'permissions', 'added', 'private', 'conflict', 'muted'];
const ALWAYS_OFFERED: ReadonlySet<StatusTone> = new Set(['added', 'changed', 'deleted', 'moved']);

/** The status chips to offer: the common ones always, the rest only while some change has them. */
export function offeredTones(present: ReadonlySet<StatusTone>): StatusTone[] {
  return TONE_ORDER.filter((tone) => ALWAYS_OFFERED.has(tone) || present.has(tone));
}

export function matchesChangeFilter(path: string, tone: StatusTone, { query, tones }: ChangeFilter): boolean {
  return (tones.size === 0 || tones.has(tone)) && path.toLowerCase().includes(query.trim().toLowerCase());
}
