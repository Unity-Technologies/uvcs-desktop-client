import { Highlighter } from 'lucide-react';
import styles from './PlainTextIndicator.module.css';

/** A quiet word in the diff's header: the file is too large to syntax highlight, so it shows as plain text (its tooltip says why). */
export function PlainTextIndicator() {
  return (
    <span className={styles.indicator} data-toolbar-extra data-tip="Syntax highlighting is off for files this large, so they open fast">
      <Highlighter size={12} aria-hidden />
      <span data-toolbar-label>Large file</span>
    </span>
  );
}
