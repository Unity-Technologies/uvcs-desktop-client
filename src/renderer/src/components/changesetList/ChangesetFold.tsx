import { ChevronDown, Layers } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './ChangesetFold.module.css';

/** The row standing for every changeset combined: its words, fitted, and its tooltip (a branch's whole name). */
export interface AllChangesRow {
  label: string;
  tip?: string;
}

/**
 * Changesets above the files, under the row that stands for them all ("All changes on task", "All incoming changes"),
 * which folds them at its end ("Changesets ⌄", a word that stays as they're read; how many is the filter's, once open).
 * Folded, that row is all there is, selected while it's what the files show, with what the place adds after it
 * (`folded`: a review's "3 new"). The row stays in its place as the list opens under it, and stands
 * apart from the list, so the filter never hides it. The list mounts only open; what the place reads while it's
 * folded, it decides (a branch diff reads no changesets).
 */
export function ChangesetFold(props: {
  allChanges: AllChangesRow;
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
