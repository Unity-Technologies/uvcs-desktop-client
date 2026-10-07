import { ChevronRight } from 'lucide-react';
import { formatCount } from '../lib/text';
import styles from './FileTree.module.css';

interface TreeGroupLabelProps {
  label: string;
  collapsed: boolean;
  /** How many items it holds. */
  count: number;
  /** What the group is, as its tooltip (e.g. "Changed on both sides"). */
  tip?: string;
}

/** A group of a list of changed files (a merge's conflicts, Incoming's files changed on both sides): its chevron, name and count. */
export function TreeGroupLabel({ label, collapsed, count, tip }: TreeGroupLabelProps) {
  return (
    <>
      <ChevronRight size={13} className={styles.chevron} data-collapsed={collapsed} aria-hidden />
      <span className={styles.groupLabel} data-tip={tip}>
        {label}
      </span>
      <span className={styles.count}>{formatCount(count)}</span>
    </>
  );
}
