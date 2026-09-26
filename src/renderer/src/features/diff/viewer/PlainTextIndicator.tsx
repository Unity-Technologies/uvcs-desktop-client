import { Highlighter } from 'lucide-react';
import styles from './PlainTextIndicator.module.css';

/** A quiet line in the diff's header: the file is too large to syntax highlight, so it shows as plain text. */
export function PlainTextIndicator() {
  return (
    <span className={styles.indicator} data-tip="Syntax highlighting is off for files this large, so they open fast">
      <Highlighter size={12} aria-hidden />
      Large file · no syntax highlighting
    </span>
  );
}
