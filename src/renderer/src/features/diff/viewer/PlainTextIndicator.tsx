import { Gauge } from 'lucide-react';
import styles from './PlainTextIndicator.module.css';

/** A quiet word in the diff's header: the file is too large to syntax highlight, so it shows as plain text. */
export function PlainTextIndicator() {
  return (
    <span className={styles.indicator} data-tip="Syntax highlighting is off for a file this large">
      <Gauge size={12} aria-hidden />
      Plain text
    </span>
  );
}
