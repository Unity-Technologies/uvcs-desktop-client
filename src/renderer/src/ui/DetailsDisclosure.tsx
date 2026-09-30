import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { classNames } from '../lib/classNames';
import styles from './DetailsDisclosure.module.css';

interface DetailsDisclosureProps {
  open: boolean;
  onToggle: () => void;
  /** Takes the type of the title it stands for (the changes pane's), instead of a quiet line's. */
  asTitle?: boolean;
  children: ReactNode;
}

/** A quiet button that shows and hides a part of a details panel, its chevron turning as it opens. */
export function DetailsDisclosure({ open, onToggle, asTitle = false, children }: DetailsDisclosureProps) {
  return (
    <button className={classNames(styles.disclosure, asTitle && styles.asTitle)} aria-expanded={open} onClick={onToggle}>
      <ChevronRight size={13} className={styles.chevron} />
      {children}
    </button>
  );
}
