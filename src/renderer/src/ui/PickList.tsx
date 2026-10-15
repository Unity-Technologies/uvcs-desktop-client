import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { keepRendered } from '../lib/keepRendered';
import { HighlightQuery } from './Highlight';
import { pickListKeyAction } from './pickListKeys';
import { SearchField } from './SearchField';
import { CenteredSpinner } from './Spinner';
import styles from './PickList.module.css';

interface PickListProps<T> {
  /** The rows the search leaves, in order; the caller matches them (`matchesWordFilter`) and marks them with `Highlight`. */
  items: readonly T[];
  itemKey: (item: T) => string;
  search: string;
  onSearchChange: (search: string) => void;
  placeholder: string;
  /** What the rows are, for screen readers: "Labels", "Users and groups". */
  label: string;
  onPick: (item: T) => void;
  /** Offered, but not picked: e.g. a member already listed. */
  isDisabled?: (item: T) => boolean;
  renderItem: (item: T) => ReactNode;
  /** Shown instead of the rows when there are none. */
  empty: ReactNode;
  /** Between the field and the rows. */
  note?: ReactNode;
  /** The rows are still being read: a spinner in their place. */
  loading?: boolean;
  /** Pixels; every row is this tall. */
  rowHeight: number;
  /** Pixels: the list keeps this height whatever the search leaves, so the dialog doesn't jump. Else it fits its rows, up to 320. */
  height?: number;
}

/**
 * A dialog's list to pick one thing from many (labels, users and groups): a search field that keeps the keys
 * (↑↓ and Page Up / Down through the rows, Enter picks, Esc empties it), then the rows, only those in view rendered,
 * so thousands open at once.
 */
export function PickList<T>({ items, itemKey, search, onSearchChange, placeholder, label, onPick, isDisabled, renderItem, empty, note, loading, rowHeight, height }: PickListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    // The row the search field's aria-activedescendant names stays rendered while the mouse wheel scrolls it away.
    rangeExtractor: (range) => keepRendered(defaultRangeExtractor(range), activeIndex, items.length),
  });

  // Typing starts over from the first match.
  useEffect(() => {
    setActive(0);
    listRef.current?.scrollTo({ top: 0 });
  }, [search]);

  const pick = (item: T | undefined): void => {
    if (item !== undefined && !isDisabled?.(item)) onPick(item);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const action = pickListKeyAction(event.key, activeIndex, items.length);
    if (action.kind === 'type') return;
    event.preventDefault();
    if (action.kind === 'move') {
      setActive(action.to);
      virtualizer.scrollToIndex(action.to);
    } else {
      pick(items[action.index]);
    }
  };

  return (
    <div className={styles.pickList}>
      <SearchField
        value={search}
        onChange={onSearchChange}
        placeholder={placeholder}
        autoFocus
        width="100%"
        aria-controls={`${id}-rows`}
        aria-activedescendant={!loading && items.length > 0 ? `${id}-${activeIndex}` : undefined}
        onKeyDown={onKeyDown}
      />
      {note}
      {loading ? (
        <CenteredSpinner />
      ) : (
        <HighlightQuery query={search}>
          <div ref={listRef} className={styles.list} style={height === undefined ? undefined : { height }}>
            {items.length === 0 && <div className={styles.empty}>{empty}</div>}
            <div id={`${id}-rows`} role="listbox" aria-label={label} className={styles.rows} style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((row) => {
                const item = items[row.index]!;
                return (
                  <div
                    key={itemKey(item)}
                    id={`${id}-${row.index}`}
                    role="option"
                    aria-selected={row.index === activeIndex}
                    aria-disabled={isDisabled?.(item) || undefined}
                    className={styles.row}
                    data-active={row.index === activeIndex}
                    style={{ top: row.start, height: row.size }}
                    // The search keeps the focus, and with it the keys.
                    onMouseDownCapture={(event) => event.preventDefault()}
                    onMouseMove={() => row.index !== activeIndex && setActive(row.index)}
                    onClick={() => pick(item)}
                  >
                    {renderItem(item)}
                  </div>
                );
              })}
            </div>
          </div>
        </HighlightQuery>
      )}
    </div>
  );
}
