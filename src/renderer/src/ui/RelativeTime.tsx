import { formatDateTime, formatRelativeDate } from '../lib/formatDate';

export function RelativeTime({ date }: { date: string }) {
  return <time title={formatDateTime(date)}>{formatRelativeDate(date)}</time>;
}
