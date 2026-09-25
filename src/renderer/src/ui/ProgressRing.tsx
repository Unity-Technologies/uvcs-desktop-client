import styles from './ProgressRing.module.css';

interface ProgressRingProps {
  /** 0..1, or null to spin while nothing tells how far along it is. */
  value: number | null;
  size?: number;
}

/** A small ring that fills as work progresses: fits where a spinner would, and tells more. */
export function ProgressRing({ value, size = 14 }: ProgressRingProps) {
  const stroke = size < 14 ? 1.75 : 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = value === null ? 0.25 : Math.min(1, Math.max(0, value));
  return (
    <svg
      className={styles.ring}
      data-indeterminate={value === null}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(shown * 100)}
    >
      <circle className={styles.track} cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
      <circle
        className={styles.arc}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - shown)}
      />
    </svg>
  );
}
