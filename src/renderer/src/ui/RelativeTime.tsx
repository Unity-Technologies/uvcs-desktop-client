import { formatDateTime, formatRelativeDate } from '../lib/formatDate';

export function RelativeTime({ date }: { date: string }) {
  return <time data-tip={formatDateTime(date)}>{formatRelativeDate(date)}</time>;
}
