/** How long the sonar ping around the current search hit lasts. */
export const PING_MS = 650;
/** How far the rings travel past where they start (world px). */
const PING_SPAN = 20;
/** The second ring leaves when the first is this far out: a double tap. */
const PING_STAGGER = 0.35;

export interface PingRing {
  /** How far the ring has grown past its start. */
  grow: number;
  alpha: number;
  width: number;
}

/**
 * The rings of the arrival ping at `progress` (0 just landed, 1 settled): two staggered rings expanding
 * while they fade. Nothing once settled, so a resting frame draws no extra.
 */
export function pingRings(progress: number): PingRing[] {
  if (progress < 0 || progress >= 1) return [];
  const rings: PingRing[] = [];
  for (const start of [0, PING_STAGGER]) {
    const p = (progress - start) / (1 - start);
    if (p <= 0 || p >= 1) continue;
    const fade = (1 - p) ** 2;
    rings.push({ grow: p * PING_SPAN, alpha: fade * 0.7, width: 0.5 + 1.5 * fade });
  }
  return rings;
}
