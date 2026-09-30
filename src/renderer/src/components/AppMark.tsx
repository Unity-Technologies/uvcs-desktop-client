import { useId } from 'react';
import styles from './AppMark.module.css';

const GLYPH = (
  <>
    <path d="M24 16v32" />
    <path d="M24 22c0 8 16 6 16 14s-16 6-16 12" />
    <circle cx="24" cy="16" r="4.5" />
    <circle cx="40" cy="34" r="4.5" />
    <circle cx="24" cy="48" r="4.5" />
  </>
);

/**
 * The app's mark: a branch leaving the main line and merging back, on the accent color. `soft` puts the branch in the
 * accent color on a faint accent tile, for where the full tile is too loud next to other chrome (the top bar).
 */
export function AppMark({ size = 28, soft = false }: { size?: number; soft?: boolean }) {
  const gradient = useId();
  return (
    <svg className={styles.mark} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className={styles.from} />
          <stop offset="1" className={styles.to} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" className={soft ? styles.softTile : undefined} fill={soft ? undefined : `url(#${gradient})`} />
      <g className={soft ? styles.softGlyph : styles.glyph}>{GLYPH}</g>
    </svg>
  );
}
