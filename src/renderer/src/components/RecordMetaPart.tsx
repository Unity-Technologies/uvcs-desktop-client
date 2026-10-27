import type { ReactNode } from 'react';
import styles from './RecordRow.module.css';

interface RecordMetaPartProps {
  /** Cut short first as the row narrows (the author's name: the avatar already says who); otherwise always whole. */
  clips?: boolean;
  children: ReactNode;
}

/** One part of a `RecordRow`'s second line (cs:N, the author, the date), a dot before each but the first. */
export function RecordMetaPart({ clips = false, children }: RecordMetaPartProps) {
  return <span className={clips ? styles.clipped : styles.whole}>{children}</span>;
}
