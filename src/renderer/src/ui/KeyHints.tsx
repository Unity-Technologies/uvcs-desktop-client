import { Kbd } from './Kbd';
import styles from './KeyHints.module.css';

/** A quiet line under a keyboard-driven list telling its keys, e.g. "⇥ actions". */
export function KeyHints({ hints }: { hints: { keys: string; label: string }[] }) {
  return (
    <div className={styles.hints}>
      {hints.map(({ keys, label }) => (
        <span key={label} className={styles.hint}>
          <Kbd keys={keys} /> {label}
        </span>
      ))}
    </div>
  );
}
