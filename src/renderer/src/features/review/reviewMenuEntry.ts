import type { GroupedEntry } from '../../lib/menuGroups';
import { hotkey } from '../../lib/shortcutRegistry';
import { menuAction } from '../../components/menuWords';
import { shouldMarkReviewed } from './reviewStatus';
import type { ListReview } from './useReviewMode';

/** "Mark as reviewed" (turning review mode on if needed) or "Clear review mark" for the selected files; nothing for folders. */
export function reviewMenuEntry<T>(items: T[], { statusOf, toggle }: ListReview<T>): GroupedEntry | null {
  const reviewable = items.filter((item) => statusOf(item) !== null);
  if (reviewable.length === 0) return null;
  return menuAction('review', () => toggle(reviewable), {
    label: shouldMarkReviewed(reviewable, statusOf) ? 'Mark as reviewed' : 'Clear review mark',
    shortcut: hotkey('review'),
  });
}
