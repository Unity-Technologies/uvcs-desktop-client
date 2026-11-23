/** How a segment was picked: clicked with a pointer, or with keys (← →, or Space or Enter on a focused segment). */
export type SegmentPick = 'pointer' | 'keys';

/**
 * How a segment's click came: a mouse, pen or touch counts its clicks in `detail`, while Space or Enter on a focused
 * button clicks it with a `detail` of 0.
 */
export function segmentPickOfClick(detail: number): SegmentPick {
  return detail > 0 ? 'pointer' : 'keys';
}

/**
 * The segment an arrow key moves to, as in a native radio group, or null for other keys: ← and → step through the
 * segments, wrapping around. ↑ and ↓ are left to whatever the control sits in (a list below it).
 */
export function segmentAfterKey<Value>(values: readonly Value[], current: Value | undefined, key: string): Value | null {
  const step = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
  if (step === 0 || values.length === 0) return null;
  const index = current === undefined ? 0 : Math.max(0, values.indexOf(current));
  return values[(index + step + values.length) % values.length]!;
}
