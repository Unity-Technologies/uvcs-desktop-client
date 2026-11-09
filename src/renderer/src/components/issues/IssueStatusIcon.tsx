import { CircleDot } from 'lucide-react';
import type { IssueStatusCategory } from '@shared/domain/issueTrackers';
import styles from '../comments/ReferenceChip.module.css';

/**
 * An issue's mark, wherever it shows (its chip, the `#` list): an open circle with a dot, in its status's color once
 * read (to do, in progress, done, canceled); the same mark, quiet, while it isn't, so reading it only colors it.
 */
export function IssueStatusIcon({ category, size }: { category: IssueStatusCategory | undefined; size: number }) {
  return <CircleDot className={styles.issueIcon} data-category={category} size={size} strokeWidth={2.25} aria-hidden />;
}
