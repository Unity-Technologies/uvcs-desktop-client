export type SincePreset = 'anyTime' | 'lastWeek' | 'last15Days' | 'lastMonth' | 'last3Months' | 'lastYear';

export const SINCE_PRESETS: { value: SincePreset; label: string; days: number | null }[] = [
  { value: 'anyTime', label: 'Any time', days: null },
  { value: 'lastWeek', label: 'Last week', days: 7 },
  { value: 'last15Days', label: 'Last 15 days', days: 15 },
  { value: 'lastMonth', label: 'Last month', days: 30 },
  { value: 'last3Months', label: 'Last 3 months', days: 91 },
  { value: 'lastYear', label: 'Last year', days: 365 },
];

/** The `YYYY-MM-DD` date a preset starts at, or undefined for "any time". */
export function sinceDateFor(preset: SincePreset, now = new Date()): string | undefined {
  const days = SINCE_PRESETS.find((candidate) => candidate.value === preset)?.days;
  if (!days) return undefined;

  const since = new Date(now);
  since.setDate(since.getDate() - days);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())}`;
}

export function sincePresetLabel(preset: SincePreset): string {
  return SINCE_PRESETS.find((candidate) => candidate.value === preset)?.label ?? '';
}
