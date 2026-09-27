import type { CSSProperties } from 'react';
import { stableHue } from '../../lib/stableHue';
import { serverInitials } from './serverInitials';
import styles from './Home.module.css';

/** A server in the folded sidebar: its initials on its own stable color, where a cloud icon would look like every other. */
export function ServerMonogram({ label }: { label: string }) {
  return (
    <span className={`${styles.avatar} ${styles.serverMonogram}`} style={{ '--hue': stableHue(label) } as CSSProperties} aria-hidden>
      {serverInitials(label)}
    </span>
  );
}
