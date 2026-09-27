/**
 * The segment an arrow key moves to, as in a native radio group, or null for other keys: ← and → step through the
 * segments, wrapping around. ↑ and ↓ are left to whatever the control sits in (a list below it).
 */
export function segmentAfterKey<Value>(values: readonly Value[], current: Value, key: string): Value | null {
  const step = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
  if (step === 0 || values.length === 0) return null;
  const index = Math.max(0, values.indexOf(current));
  return values[(index + step + values.length) % values.length]!;
}
