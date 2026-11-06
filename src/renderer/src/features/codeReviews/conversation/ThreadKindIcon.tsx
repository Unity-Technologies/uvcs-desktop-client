import { CircleHelp, GitPullRequestArrow } from 'lucide-react';
import { openItemKind } from './threadBadges';
import type { ReviewThread } from './reviewThreads';
import styles from './ReviewConversation.module.css';

const ICONS = { Question: CircleHelp, 'Change request': GitPullRequestArrow } as const;

/** A change request's or a question's icon, named for a screen reader and in its tooltip. */
export function ThreadKindIcon({ root, size = 13 }: { root: ReviewThread['root']; size?: number }) {
  const kind = openItemKind(root);
  const Icon = ICONS[kind];
  return (
    <span role="img" aria-label={kind} data-tip={kind} className={styles.kindIcon}>
      <Icon size={size} aria-hidden />
    </span>
  );
}
