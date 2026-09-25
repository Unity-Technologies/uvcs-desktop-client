import { formatShortcut } from '../lib/shortcuts';
import styles from './Kbd.module.css';

/** Renders a shortcut such as `mod+shift+k` as platform-specific key caps. */
export function Kbd({ keys }: { keys: string }) {
  return (
    <span className={styles.kbd}>
      {formatShortcut(keys).map((key) => (
        <kbd key={key}>{key}</kbd>
      ))}
    </span>
  );
}
