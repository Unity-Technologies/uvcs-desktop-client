import { isValidElement, type ReactNode } from 'react';
import { Highlight } from '../Highlight';
import styles from './DataTable.module.css';

/**
 * Plain text in a cell, in a box of its own: a cell is a flex row, where bare text (and the pieces a `Highlight` splits it
 * into) can't end in an ellipsis, so it would be cut mid-letter.
 */
export function cellText(content: ReactNode): ReactNode {
  const isText = typeof content === 'string' || typeof content === 'number' || (isValidElement(content) && content.type === Highlight);
  return isText ? <span className={styles.text}>{content}</span> : content;
}
