import type { CSSProperties } from 'react';
import type { ProgressBarState } from './progressBar';
import styles from './ProgressTrack.module.css';

interface ProgressTrackProps {
  bar: ProgressBarState;
  /** Done: the bar, full in `--tone`, runs out over this time as a countdown, then calls `onCountdownEnd`. */
  countdownMs?: number;
  onCountdownEnd?: () => void;
  className?: string;
}

/**
 * A slim progress bar. Its fill glides linearly (a transform, on the compositor) towards where the next report should
 * land, sweeps while nothing tells how far along it is, and shimmers when full but still busy.
 */
export function ProgressTrack({ bar, countdownMs, onCountdownEnd, className }: ProgressTrackProps) {
  return (
    <div className={`${styles.track} ${className ?? ''}`}>
      {countdownMs !== undefined ? (
        <span className={styles.countdown} data-countdown style={{ animationDuration: `${countdownMs}ms` }} onAnimationEnd={onCountdownEnd} />
      ) : (
        <span
          // A new stretch of work (or the end of the sweep) grows a new fill from zero, instead of shrinking the old one.
          key={bar.mode === 'sweep' ? 'sweep' : `fill-${bar.motion?.key}`}
          className={styles.fill}
          data-mode={bar.mode}
          style={{ '--value': bar.value, transitionDuration: `${bar.durationMs}ms` } as CSSProperties}
        />
      )}
    </div>
  );
}
