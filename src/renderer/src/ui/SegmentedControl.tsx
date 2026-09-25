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
}

export function SegmentedControl<Value extends string>({ value, segments, onChange }: SegmentedControlProps<Value>) {
  return (
    <div className={styles.control} role="radiogroup">
      {segments.map((segment) => (
        <button
          key={segment.value}
          role="radio"
          aria-checked={segment.value === value}
          title={segment.title}
          className={styles.segment}
          onClick={() => onChange(segment.value)}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
