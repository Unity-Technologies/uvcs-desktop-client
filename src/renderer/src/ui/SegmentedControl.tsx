import type { ReactNode } from 'react';
import styles from './SegmentedControl.module.css';

interface Segment<Value extends string> {
  value: Value;
  label: ReactNode;
  title?: string;
}

interface SegmentedControlProps<Value extends string> {
  value: Value;
  segments: Segment<Value>[];
  onChange: (value: Value) => void;
  /** Fills the width it is given, sharing it equally between the segments. */
  stretch?: boolean;
}

export function SegmentedControl<Value extends string>({ value, segments, onChange, stretch = false }: SegmentedControlProps<Value>) {
  return (
    <div className={styles.control} role="radiogroup" data-stretch={stretch}>
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          role="radio"
          aria-checked={segment.value === value}
          data-tip={segment.title}
          className={styles.segment}
          onClick={() => onChange(segment.value)}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
