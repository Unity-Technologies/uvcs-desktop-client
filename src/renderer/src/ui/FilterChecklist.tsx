import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Checkbox } from './Checkbox';
import { checklistKeyAction } from './checklistKeys';
import { HighlightQuery } from './Highlight';
import { SearchField } from './SearchField';
import styles from './FilterChecklist.module.css';

interface FilterChecklistProps {
  /** The rows the search leaves, in order; the caller matches them (`matchesWordFilter`) and marks them with `Highlight`. */
  rows: readonly string[];
  search: string;
  onSearchChange: (search: string) => void;
  placeholder: string;
  /** What the rows are, for screen readers: "Branches", "People". */
  label: string;
  isChecked: (row: string) => boolean;
  onToggle: (row: string) => void;
  /** Checks just this row: an "Only" button shows on the row under the pointer. */
  onOnly?: (row: string) => void;
  renderRow: (row: string) => ReactNode;
  /** Between the field and the rows: what is checked, bulk actions. */
  summary?: ReactNode;
  /** Shown instead of the rows when the search leaves none. */
  empty: ReactNode;
  /** A note under the rows. */
  footer?: ReactNode;
  /** Pixels; matches `.row` in the CSS by default. */
  rowHeight?: number;
}

const ROW_HEIGHT = 28;

/**
 * The list of a filter that picks from many (branches, people), in its popover: a search field that keeps the keys
 * (↑↓ through the rows, Enter or Space to check one, Esc to empty it), then the rows, only those in view rendered, so
 * 20,000 branches or 500 people open at once.
 */
export function FilterChecklist({ rows, search, onSearchChange, placeholder, label, isChecked, onToggle, onOnly, renderRow, summary, empty, footer, rowHeight = ROW_HEIGHT }: FilterChecklistProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const [active, setActive] = useState(-1);
  const [browsing, setBrowsing] = useState(false);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => listRef.current, estimateSize: () => rowHeight, overscan: 8 });

  // Typing starts over from the first match; clearing the search leaves the rows unpicked.
  useEffect(() => {
    setActive(search.trim() ? 0 : -1);
    setBrowsing(false);
    listRef.current?.scrollTo({ top: 0 });
  }, [search]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const action = checklistKeyAction(event.key, { active, rowCount: rows.length, browsing });
    if (action.kind === 'type') {
      setBrowsing(false);
      return;
    }
    event.preventDefault();
    if (action.kind === 'move') {
      setActive(action.to);
      setBrowsing(true);
      virtualizer.scrollToIndex(action.to);
    } else {
      setActive(action.index);
      onToggle(rows[action.index]!);
    }
  };

  return (
    <div className={styles.checklist}>
      <div className={styles.search}>
        <SearchField
          value={search}
          onChange={onSearchChange}
          placeholder={placeholder}
          width="100%"
          autoFocus
          onKeyDown={onKeyDown}
          aria-controls={`${id}-rows`}
          aria-activedescendant={active >= 0 && active < rows.length ? `${id}-${active}` : undefined}
        />
      </div>
      {summary && <div className={styles.summary}>{summary}</div>}
      {rows.length === 0 ? (
        <div className={styles.empty}>{empty}</div>
      ) : (
        <HighlightQuery query={search}>
          <div ref={listRef} className={styles.list}>
            <div id={`${id}-rows`} role="listbox" aria-label={label} aria-multiselectable className={styles.rows} style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((item) => {
                const row = rows[item.index]!;
                const checked = isChecked(row);
                return (
                  <div
                    key={row}
                    id={`${id}-${item.index}`}
                    role="option"
                    aria-selected={checked}
                    className={styles.row}
                    data-active={item.index === active}
                    style={{ top: item.start, height: item.size }}
                    // The search keeps the focus, and with it the keys.
                    onMouseDownCapture={(event) => event.preventDefault()}
                    onMouseMove={() => item.index !== active && setActive(item.index)}
                    onClick={() => onToggle(row)}
                  >
                    <Checkbox checked={checked} onChange={() => onToggle(row)} focusable={false} ariaLabel={row} />
                    <span className={styles.label}>{renderRow(row)}</span>
                    {onOnly && (
                      <button
                        type="button"
                        tabIndex={-1}
                        className={styles.only}
                        data-tip="Check only this one"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOnly(row);
                        }}
                      >
                        Only
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </HighlightQuery>
      )}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
