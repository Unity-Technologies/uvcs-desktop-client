import { useId } from 'react';
import { APP_MARK } from '@shared/appMark';
import styles from './AppMark.module.css';

const GLYPH = (
  <>
    {APP_MARK.lines.map((d) => (
      <path key={d} d={d} />
    ))}
    {APP_MARK.changesets.map(({ cx, cy }) => (
      <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={APP_MARK.changesetRadius} />
    ))}
  </>
);

/**
 * The app's mark (`APP_MARK`, the artwork the app's icons are made from) on the accent color. `soft` puts the branch
 * in the accent color on a faint accent tile, for where the full tile is too loud next to other chrome (the top bar).
 */
export function AppMark({ size = 28, soft = false }: { size?: number; soft?: boolean }) {
  const gradient = useId();
  const viewBox = `0 0 ${APP_MARK.size} ${APP_MARK.size}`;
  return (
    <svg className={styles.mark} width={size} height={size} viewBox={viewBox} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className={styles.from} />
          <stop offset="1" className={styles.to} />
        </linearGradient>
      </defs>
      <rect
        width={APP_MARK.size}
        height={APP_MARK.size}
        rx={APP_MARK.tileRadius}
        className={soft ? styles.softTile : undefined}
        fill={soft ? undefined : `url(#${gradient})`}
      />
      <g className={soft ? styles.softGlyph : styles.glyph} strokeWidth={APP_MARK.strokeWidth}>
        {GLYPH}
      </g>
    </svg>
  );
}
