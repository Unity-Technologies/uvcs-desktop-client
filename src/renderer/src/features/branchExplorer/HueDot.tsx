import type { CSSProperties } from 'react';
import styles from './HueDot.module.css';

/** A dot in the color the graph draws `hue` with (`hueToColor`), or the accent when there is none. */
export function HueDot({ hue, size = 8 }: { hue: number | null; size?: number }) {
  const style = { '--branch-hue': hue ?? undefined, '--dot-size': `${size}px` } as CSSProperties;
  return <span className={styles.dot} data-hue={hue ?? undefined} style={style} aria-hidden />;
}
