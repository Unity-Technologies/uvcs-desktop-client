import { classNames } from '../lib/classNames';
import { Kbd } from './Kbd';
import styles from './KeyHints.module.css';

/** A hint: its keys (one shortcut, or several, each its caps), or text typed as written (`typed`), and what it does. */
export interface KeyHint {
  keys: string | readonly string[];
  label: string;
  typed?: boolean;
}

/**
 * A quiet line under a keyboard-driven list telling its keys, e.g. "⇥ actions": a footer, its top border apart from the
 * list, or a `caption` right under a field, as a field's help reads.
 */
export function KeyHints({ hints, caption = false }: { hints: readonly KeyHint[]; caption?: boolean }) {
  return (
    <div className={classNames(styles.hints, caption && styles.caption)}>
      {hints.map(({ keys, label, typed }) => (
        <span key={label} className={styles.hint}>
          {(typeof keys === 'string' ? [keys] : keys).map((key) => (
            <Kbd key={key} keys={key} typed={typed} />
          ))}{' '}
          {label}
        </span>
      ))}
    </div>
  );
}
