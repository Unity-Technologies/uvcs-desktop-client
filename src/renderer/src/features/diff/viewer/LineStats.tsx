import { pluralize } from '../../../lib/text';
import type { LineDiff } from './lineDiff';
import styles from './LineStats.module.css';

/** `+added −removed`, in the added and deleted status colors; zeros fade out. */
export function LineStats({ added, removed }: Pick<LineDiff, 'added' | 'removed'>) {
  return (
    <span className={styles.stats} data-toolbar-extra data-tip={`${pluralize(added, 'line')} added, ${pluralize(removed, 'line')} removed`}>
      <span className={styles.added} data-zero={added === 0}>+{added}</span>
      <span className={styles.removed} data-zero={removed === 0}>−{removed}</span>
    </span>
  );
}
