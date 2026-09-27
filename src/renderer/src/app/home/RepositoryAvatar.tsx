import type { CSSProperties } from 'react';
import { initialOf } from '../../lib/initialOf';
import { lastSegment } from '../../lib/paths';
import { stableHue } from '../../lib/stableHue';
import styles from './Home.module.css';

/**
 * An initial on the repository's own stable color, so workspaces of the same repository look alike at a glance. The
 * letter is the repository's, or `label`'s (a workspace shows its own name's, as everywhere else).
 */
export function RepositoryAvatar({ name, label = name, size }: { name: string; label?: string; size: number }) {
  const shortName = lastSegment(name) || name;
  return (
    <span className={styles.avatar} style={{ '--hue': stableHue(shortName), width: size, height: size } as CSSProperties} aria-hidden>
      {initialOf(label)}
    </span>
  );
}
