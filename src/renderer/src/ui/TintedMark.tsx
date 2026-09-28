import type { CSSProperties, ReactNode } from 'react';
import styles from './TintedMark.module.css';

interface TintedMarkProps {
  /** From `stableHue`, so the same name always gets the same color. */
  hue: number;
  size: number;
  className?: string;
  children: ReactNode;
}

/** A letter or two on a tint of a name's own color (avatars of workspaces and repositories, server monograms). */
export function TintedMark({ hue, size, className, children }: TintedMarkProps) {
  return (
    <span
      className={className ? `${styles.mark} ${className}` : styles.mark}
      data-small={size <= 24}
      style={{ '--hue': hue, width: size, height: size } as CSSProperties}
      aria-hidden
    >
      {children}
    </span>
  );
}
