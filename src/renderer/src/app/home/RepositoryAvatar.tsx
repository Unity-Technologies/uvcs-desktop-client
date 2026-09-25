import type { CSSProperties } from 'react';
import { lastSegment } from '../../lib/paths';
import { stableHue } from '../../lib/stableHue';
import styles from './Home.module.css';

/** The initial of a repository on its own stable color, so workspaces of the same repository look alike at a glance. */
export function RepositoryAvatar({ name, size }: { name: string; size: number }) {
  const shortName = lastSegment(name) || name;
  return (
    <span className={styles.avatar} style={{ '--hue': stableHue(shortName), width: size, height: size } as CSSProperties} aria-hidden>
      {shortName.charAt(0).toUpperCase()}
    </span>
  );
}
