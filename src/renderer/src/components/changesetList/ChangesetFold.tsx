import { ChevronDown, Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './ChangesetFold.module.css';

/**
 * The changesets above the files, under the row that stands for them all, "All changes on task", which folds them
 * (its end, "Changesets ⌄", a word that stays as they're read; how many is the filter's, once open): who reviews the
 * whole branch sees that row only, selected while the diff shows all the changes, with "3 new" on a review's page
 * (`folded`). The row stays in its place as the list opens under it, and stands apart from the list (`allApart`), so
 * the filter never hides it. The list mounts only open, so folded it reads nothing.
 */
export function ChangesetFold(props: {
  allChanges: { label: string; tip: string };
  selected: boolean;
  onSelectAll: () => void;
  foldLabel: string;
  open: boolean;
  onToggle: () => void;
  folded?: ReactNode;
  children: ReactNode;
}) {
  const { allChanges, selected, onSelectAll, foldLabel, open, onToggle, folded, children } = props;
  return (
    <div className={styles.fold} data-open={open || undefined}>
      <div className={styles.allRow} data-selected={selected || undefined}>
        <button type="button" className={styles.allButton} aria-pressed={selected} data-tip={allChanges.tip} onClick={onSelectAll}>
          <Layers size={14} className={styles.allIcon} aria-hidden />
          <span className={styles.allLabel}>{allChanges.label}</span>
        </button>
        {!open && folded}
        <button type="button" className={styles.foldToggle} aria-expanded={open} data-tip={foldLabel} onClick={onToggle}>
          Changesets
          <ChevronDown size={14} className={styles.foldChevron} aria-hidden />
        </button>
      </div>
      {open && children}
    </div>
  );
}
