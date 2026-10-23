import { classNames } from '../lib/classNames';
import styles from './PercentSlider.module.css';

interface PercentSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Steps of 5% by default: a finer one can't be told apart by hand. */
  step?: number;
  disabled?: boolean;
  className?: string;
}

/** A percentage picked with a slider: its label, the slider, and the value it reads, as "80%". */
export function PercentSlider({ label, value, onChange, min = 0, step = 5, disabled, className }: PercentSliderProps) {
  return (
    <label className={classNames(styles.slider, className)}>
      <span>{label}</span>
      <input type="range" min={min} max={100} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
      <span className={styles.value}>{value}%</span>
    </label>
  );
}
