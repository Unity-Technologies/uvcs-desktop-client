import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatCount } from '../lib/text';
import styles from './FileTree.module.css';

interface TreeGroupLabelProps {
  label: string;
  /** Before the name: a status group's badge. */
  icon?: ReactNode;
  collapsed: boolean;
  /** Between the chevron and the icon: Incoming's checkbox choosing what an update brings. */
  before?: ReactNode;
  /** How many items it holds. */
  count: number;
  /** What it says instead of the count, e.g. how many of its conflicts are resolved ("1 of 3"), and that count's tooltip. */
  progress?: GroupProgress;
  /** What the group is, as its tooltip (e.g. "Changed on both sides"). */
  tip?: string;
}

export interface GroupProgress {
  /** Shown in place of the count, e.g. "1 of 3". */
  count: string;
  /** What the count means, as its tooltip, e.g. "1 resolved, 2 to decide". */
  tip?: string;
}

/** A group of a list of changed files (a merge's conflicts, Incoming's files changed on both sides): its chevron, name and count. */
export function TreeGroupLabel({ label, icon, collapsed, count, progress, tip }: TreeGroupLabelProps) {
  return (
    <>
      <ChevronRight size={13} className={styles.chevron} data-collapsed={collapsed} aria-hidden />
      {before}
      {icon}
      <span className={styles.groupLabel} data-tip={tip}>
        {label}
      </span>
      <span className={styles.count} data-tip={progress?.tip}>
        {progress ? progress.count : formatCount(count)}
      </span>
    </>
  );
}
