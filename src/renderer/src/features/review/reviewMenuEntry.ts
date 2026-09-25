import { CircleCheck } from 'lucide-react';
import type { MenuEntry } from '../../lib/actions';
import { shouldMarkReviewed } from './reviewStatus';
import type { ListReview } from './useReviewMode';
import { hotkey } from '../../lib/shortcutRegistry';

/** "Mark as reviewed" (turning review mode on if needed) or "Clear review mark" for the selected files; nothing for folders. */
export function reviewMenuEntry<T>(items: T[], { statusOf, toggle }: ListReview<T>): MenuEntry | null {
  const reviewable = items.filter((item) => statusOf(item) !== null);
  if (reviewable.length === 0) return null;
  return {
    id: 'review',
    label: shouldMarkReviewed(reviewable, statusOf) ? 'Mark as reviewed' : 'Clear review mark',
    icon: CircleCheck,
    shortcut: hotkey('review'),
    run: () => toggle(reviewable),
  };
}
