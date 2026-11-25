import { CircleHelp, GitPullRequestArrow, MessageSquare } from 'lucide-react';
import type { ThreadKindName } from './threadBadges';
import styles from './ReviewConversation.module.css';

/** Each kind's icon, by its name (`threadKindName`): leading a thread's pill (`HeaderPill`), the side rail and the Comments panel's kind chips. */
export const THREAD_KIND_ICONS = { Question: CircleHelp, 'Change request': GitPullRequestArrow, Comment: MessageSquare } as const;

/**
 * A thread's kind as an icon (a change request, a question, a plain comment), named for a screen reader and in its
 * tooltip: by its kind, or by the `name` given ("Change request 2c17a694", `HeaderPill.kindTip`); a null `name` beside
 * words that name it already, where it is only drawn.
 */
export function ThreadKindIcon({ kind, size = 13, name = kind }: { kind: ThreadKindName; size?: number; name?: string | null }) {
  const Icon = THREAD_KIND_ICONS[kind];
  return name !== null ? (
    <span role="img" aria-label={name} data-tip={name} className={styles.kindIcon}>
      <Icon size={size} aria-hidden />
    </span>
  ) : (
    <span aria-hidden className={styles.kindIcon}>
      <Icon size={size} />
    </span>
  );
}
