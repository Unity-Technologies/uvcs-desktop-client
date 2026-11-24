import type { CSSProperties } from 'react';
import styles from './SuggestedChangeBlock.module.css';

/** The place a suggestion's rows take, held while its lines are read or Pierre loads, so nothing moves as they arrive. */
export function SuggestionPlaceholder({ rowCount }: { rowCount: number }) {
  return <div className={styles.placeholder} style={{ '--rows': rowCount } as CSSProperties} aria-hidden />;
}
