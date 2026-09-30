import type { SincePreset } from './sincePresets';

/**
 * What an empty list read within a time range suggests (ARCHITECTURE.md "Counts and empty lists"): a longer range,
 * as the filters only look through what the range read. Nothing past "Any time".
 */
export function longerRangeHint(since: SincePreset, filtering: boolean): string | undefined {
  if (since === 'anyTime') return undefined;
  return filtering ? 'The filters look within the time range. Try a longer one.' : 'Try a longer time range.';
}
