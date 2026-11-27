import { formatShortcut } from '../lib/shortcuts';
import styles from './Kbd.module.css';

/**
 * Renders a shortcut such as `mod+shift+k` as platform-specific key caps; `typed` shows text typed as written
 * instead (`cs:`), a cap of its own. Nothing for a shortcut a person removed (`hotkey`).
 */
export function Kbd({ keys, typed = false }: { keys: string | undefined; typed?: boolean }) {
  if (keys === undefined) return null;
  return (
    <span className={styles.kbd}>
      {(typed ? [keys] : formatShortcut(keys)).map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}
