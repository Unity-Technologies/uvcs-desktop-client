import { formatShortcut } from '../lib/shortcuts';
import styles from './Kbd.module.css';

/**
 * Renders a shortcut such as `mod+shift+k` as platform-specific key caps; `typed` shows text typed as written
 * instead (`cs:`), a cap of its own.
 */
export function Kbd({ keys, typed = false }: { keys: string; typed?: boolean }) {
  return (
    <span className={styles.kbd}>
      {(typed ? [keys] : formatShortcut(keys)).map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}
