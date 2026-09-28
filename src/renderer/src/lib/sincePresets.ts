export type SincePreset = 'lastWeek' | 'last15Days' | 'lastMonth' | 'last3Months' | 'last6Months' | 'lastYear' | 'anyTime';

/** Every view's time range, from the shortest to "Any time", as its menu lists them. */
export const SINCE_PRESETS: { value: SincePreset; label: string; days: number | null }[] = [
  { value: 'lastWeek', label: 'Last week', days: 7 },
  { value: 'last15Days', label: 'Last 15 days', days: 15 },
  { value: 'lastMonth', label: 'Last month', days: 30 },
  { value: 'last3Months', label: 'Last 3 months', days: 91 },
  { value: 'last6Months', label: 'Last 6 months', days: 182 },
  { value: 'lastYear', label: 'Last year', days: 365 },
  { value: 'anyTime', label: 'Any time', days: null },
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

/** The presets longer than `preset`, shortest first. */
export function longerPresets(preset: SincePreset): SincePreset[] {
  return SINCE_PRESETS.slice(SINCE_PRESETS.findIndex((candidate) => candidate.value === preset) + 1).map((candidate) => candidate.value);
}

/** The preset the Branch Explorer remembered before every view shared these (its own ids), or the preset itself. */
export function sincePresetOf(remembered: unknown): SincePreset | undefined {
  const legacy: Record<string, SincePreset> = { week: 'lastWeek', twoWeeks: 'last15Days', month: 'lastMonth', quarter: 'last3Months', halfYear: 'last6Months', year: 'lastYear', all: 'anyTime' };
  if (typeof remembered !== 'string') return undefined;
  if (SINCE_PRESETS.some((candidate) => candidate.value === remembered)) return remembered as SincePreset;
  return legacy[remembered];
}
