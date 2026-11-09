import { CircleHelp, GitPullRequestArrow, MessageSquare } from 'lucide-react';
import { threadKindName } from './threadBadges';
import type { ReviewThread } from './reviewThreads';
import styles from './ReviewConversation.module.css';

const ICONS = { Question: CircleHelp, 'Change request': GitPullRequestArrow, Comment: MessageSquare } as const;

/** A thread's kind as an icon (a change request, a question, a plain comment), named for a screen reader and in its tooltip. */
export function ThreadKindIcon({ root, size = 13 }: { root: ReviewThread['root']; size?: number }) {
  const kind = threadKindName(root);
  const Icon = ICONS[kind];
  return (
    <span role="img" aria-label={kind} data-tip={kind} className={styles.kindIcon}>
      <Icon size={size} aria-hidden />
    </span>
  );
}
