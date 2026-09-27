import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { segmentAfterKey } from './segmentKeys';
import styles from './SegmentedControl.module.css';

interface Segment<Value extends string> {
  value: Value;
  label: ReactNode;
  title?: string;
  /** Shown in the segment's tooltip. */
  shortcut?: string;
}

interface SegmentedControlProps<Value extends string> {
  value: Value;
  segments: Segment<Value>[];
  onChange: (value: Value) => void;
  /** Fills the width it is given, sharing it equally between the segments. */
  stretch?: boolean;
  label?: string;
}

/** A radio group: one Tab stop (the checked segment), ← → pick the others. */
export function SegmentedControl<Value extends string>({ value, segments, onChange, stretch = false, label }: SegmentedControlProps<Value>) {
  const controlRef = useRef<HTMLDivElement>(null);

  const pickWithArrows = (event: KeyboardEvent): void => {
    const next = segmentAfterKey(
      segments.map((segment) => segment.value),
      value,
      event.key,
    );
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    controlRef.current?.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  };

  return (
    <div ref={controlRef} className={styles.control} role="radiogroup" aria-label={label} data-stretch={stretch} onKeyDown={pickWithArrows}>
      {segments.map((segment) => (
        <button
          key={segment.value}
          type="button"
          role="radio"
          aria-checked={segment.value === value}
          tabIndex={segment.value === value ? 0 : -1}
          data-value={segment.value}
          data-tip={segment.title}
          data-tip-shortcut={segment.shortcut}
          aria-label={segment.title}
          className={styles.segment}
          onClick={() => onChange(segment.value)}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
