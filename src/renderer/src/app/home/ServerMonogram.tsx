import type { CSSProperties } from 'react';
import { stableHue } from '../../lib/stableHue';
import { serverInitials } from './serverInitials';
import styles from './Home.module.css';

/**
 * A server in the folded sidebar: its initials on a tint of its own stable color, where a cloud icon would look like
 * every other. A tint, not the solid fill of workspace avatars: a server is secondary to the workspaces on it.
 */
export function ServerMonogram({ label }: { label: string }) {
  return (
    <span className={styles.serverMonogram} style={{ '--hue': stableHue(label) } as CSSProperties} aria-hidden>
      {serverInitials(label)}
    </span>
  );
}
