import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { segmentAfterKey, segmentPickOfClick, type SegmentPick } from './segmentKeys';
import styles from './SegmentedControl.module.css';

interface Segment<Value extends string> {
  value: Value;
  label: ReactNode;
  title?: string;
  /** Shown in the segment's tooltip. */
  shortcut?: string;
}

interface SegmentedControlProps<Value extends string> {
  /** The checked segment; none until one is picked (the first one is then the Tab stop, as in a native radio group). */
  value: Value | undefined;
  segments: Segment<Value>[];
  /** `pick` says how: a choice beside a text can give the focus back to it after a click (a new comment's kind). */
  onChange: (value: Value, pick: SegmentPick) => void;
  /** Fills the width it is given, sharing it equally between the segments. */
  stretch?: boolean;
  /** Smaller and quieter, for a choice that sits inside a card rather than leading a view (a new comment's kind). */
  small?: boolean;
  /** The toolbar's track and raised segment (Split | Unified), lower, for a header as tight as a code box's. */
  dense?: boolean;
  label?: string;
}

/** A radio group: one Tab stop (the checked segment), ← → pick the others. */
export function SegmentedControl<Value extends string>({ value, segments, onChange, stretch = false, small = false, dense = false, label }: SegmentedControlProps<Value>) {
  const controlRef = useRef<HTMLDivElement>(null);

  const pickWithArrows = (event: KeyboardEvent): void => {
    const next = segmentAfterKey(
      segments.map((segment) => segment.value),
      value,
      event.key,
    );
    if (next === null) return;
    event.preventDefault();
    onChange(next, 'keys');
    controlRef.current?.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  };

  return (
    <div ref={controlRef} className={styles.control} role="radiogroup" aria-label={label} data-stretch={stretch} data-small={small || undefined} data-dense={dense || undefined} onKeyDown={pickWithArrows}>
      {segments.map((segment, index) => (
        <button
          key={segment.value}
          type="button"
          role="radio"
          aria-checked={segment.value === value}
          tabIndex={segment.value === value || (value === undefined && index === 0) ? 0 : -1}
          data-value={segment.value}
          data-tip={segment.title}
          data-tip-shortcut={segment.shortcut}
          aria-label={segment.title}
          className={styles.segment}
          onClick={(event) => onChange(segment.value, segmentPickOfClick(event.detail))}
        >
          {segment.label}
        </button>
      ))}
    </div>
  );
}
