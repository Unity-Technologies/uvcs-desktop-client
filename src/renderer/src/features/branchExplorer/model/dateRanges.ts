export type DateRangeId = 'week' | 'twoWeeks' | 'month' | 'quarter' | 'halfYear' | 'year' | 'all';

export const DATE_RANGES: { id: DateRangeId; label: string; days: number | null }[] = [
  { id: 'week', label: 'Last week', days: 7 },
  { id: 'twoWeeks', label: 'Last 2 weeks', days: 14 },
  { id: 'month', label: 'Last month', days: 30 },
  { id: 'quarter', label: 'Last 3 months', days: 91 },
  { id: 'halfYear', label: 'Last 6 months', days: 182 },
  { id: 'year', label: 'Last year', days: 365 },
  { id: 'all', label: 'All history', days: null },
];

/** The `YYYY-MM-DD` date a range starts at, or undefined for all history. */
export function sinceDateFor(rangeId: DateRangeId, now = new Date()): string | undefined {
  const days = DATE_RANGES.find((range) => range.id === rangeId)?.days;
  if (!days) return undefined;
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  return `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
}
