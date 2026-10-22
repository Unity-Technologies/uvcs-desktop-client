import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import { keepRendered } from '../lib/keepRendered';
import styles from './Combobox.module.css';

/** Pixels: every option row is this tall (`Combobox.module.css` `.option`). */
const OPTION_HEIGHT = 28;

interface ComboboxListProps {
  id: string;
  /** What the options are, for screen readers: "Repositories". */
  label: string;
  options: readonly string[];
  /** The row highlighted; -1 for none. */
  active: number;
  onHighlight: (index: number) => void;
  onPick: (option: string) => void;
}

/**
 * A combobox's options, only the rows in view rendered (a server's repositories run into the thousands). It owns its
 * virtualizer because the popover mounts it a render after the combobox opens: a virtualizer in the combobox never saw
 * this scroll element appear, and listed no rows.
 */
export function ComboboxList({ id, label, options, active, onHighlight, onPick }: ComboboxListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => OPTION_HEIGHT,
    overscan: 8,
    // The row the field's aria-activedescendant names stays rendered while the wheel scrolls it away.
    rangeExtractor: (range) => keepRendered(defaultRangeExtractor(range), active, options.length),
  });

  // The highlighted row stays in view: the option the field holds as the list opens, then each row the keys reach. Not a
  // row the pointer highlights: scrolling a half-visible one into view would slide the next under the pointer, and creep.
  const highlightedByPointer = useRef(-1);
  useEffect(() => {
    if (active >= 0 && active !== highlightedByPointer.current) virtualizer.scrollToIndex(active);
  }, [active, virtualizer]);

  return (
    <div ref={listRef} className={styles.list}>
      <div id={id} role="listbox" aria-label={label} className={styles.rows} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const option = options[row.index]!;
          return (
            <div
              key={option}
              id={`${id}-${row.index}`}
              role="option"
              aria-selected={row.index === active}
              className={styles.option}
              style={{ top: row.start, height: row.size }}
              // A move, not an enter: a row that appears under a still pointer doesn't take Enter from a typed name.
              onMouseMove={() => {
                if (row.index === active) return;
                highlightedByPointer.current = row.index;
                onHighlight(row.index);
              }}
              onClick={() => onPick(option)}
            >
              <span className={styles.optionText}>{option}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
