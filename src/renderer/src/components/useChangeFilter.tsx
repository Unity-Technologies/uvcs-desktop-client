import { useMemo, useState, type ReactNode } from 'react';
import { formatCount } from '../lib/text';
import { FilterField } from '../ui/FilterField';
import { SearchField } from '../ui/SearchField';
import { Tooltip } from '../ui/Tooltip';
import { FileListLayoutMenu } from './FileListLayoutMenu';
import { changeFilterPlaceholder, countTones, matchesChangeFilter, offeredTones } from './changeFilter';
import { STATUS_LETTERS, StatusLetter, type StatusTone } from './StatusBadge';
import styles from './useChangeFilter.module.css';

const TONE_LABELS: Record<StatusTone, string> = {
  added: 'Added',
  changed: 'Changed',
  deleted: 'Deleted',
  moved: 'Moved',
  permissions: 'Only filesystem permissions',
  private: 'Private',
  conflict: 'Conflicts',
  muted: 'Ignored, cloaked and hidden',
};

export interface ChangeFilterOptions {
  /** The list a view or page works on (Changes, a diff's files): its field takes ⌘F as every view's filter does. */
  isViewFilter?: boolean;
  /** Words a chip as the list's groups do (Incoming's "Conflicts with your changes"). */
  toneLabels?: Partial<Record<StatusTone, string>>;
  /** At the row's end, after the List/Tree switch: the list's own modes (the review mode toggle). */
  actions?: ReactNode;
  /** The items are still being read: the field doesn't count them yet, and waits for them to filter anything. */
  reading?: boolean;
}

const NO_TONE_LABELS: Partial<Record<StatusTone, string>> = {};

export interface ChangeFilterResult<T> {
  visible: T[];
  /** The text typed, for highlighting matches. */
  query: string;
  /** Empties the text and turns every status chip off. */
  clear: () => void;
  /** The filter field followed by one toggle chip per status, the List/Tree switch (`FileListLayoutMenu`) and the list's `actions`. */
  bar: ReactNode;
}

/**
 * Filters a list of changed files by path and by status (A, M, D, R...), each file found by any of its statuses
 * (`statusTones`: a moved file that changed by C and M). Its bar also holds the List/Tree switch every list of
 * changed files shares, at the same place in each.
 */
export function useChangeFilter<T>(
  items: T[],
  pathOf: (item: T) => string,
  tonesOf: (item: T) => readonly StatusTone[],
  { isViewFilter = false, toneLabels = NO_TONE_LABELS, actions, reading = false }: ChangeFilterOptions = {},
): ChangeFilterResult<T> {
  const [query, setQuery] = useState('');
  const [chosenTones, setChosenTones] = useState<ReadonlySet<StatusTone>>(new Set());

  const counts = useMemo(() => countTones(items.map(tonesOf)), [items, tonesOf]);
  const tones = useMemo(() => offeredTones(new Set(counts.keys())), [counts]);
  // A chip can go away while chosen (the last private file is added); never keep filtering by a hidden chip.
  const activeTones = useMemo(() => new Set([...chosenTones].filter((tone) => tones.includes(tone))), [chosenTones, tones]);
  const visible = useMemo(
    // Nothing to filter by keeps the very list: what is worked out from it isn't worked out again.
    () => (query.trim() === '' && activeTones.size === 0 ? items : items.filter((item) => matchesChangeFilter(pathOf(item), tonesOf(item), { query, tones: activeTones }))),
    [items, pathOf, tonesOf, query, activeTones],
  );

  const clear = (): void => {
    setQuery('');
    setChosenTones(new Set());
  };

  const toggle = (tone: StatusTone): void =>
    setChosenTones((current) => {
      const next = new Set(current);
      if (next.has(tone)) next.delete(tone);
      else next.add(tone);
      return next;
    });

  const placeholder = changeFilterPlaceholder(reading ? undefined : items.length);
  const bar = (
    <div className={styles.bar}>
      {isViewFilter ? (
        <FilterField value={query} onChange={setQuery} placeholder={placeholder} width="100%" disabled={reading} />
      ) : (
        <SearchField value={query} onChange={setQuery} placeholder={placeholder} width="100%" disabled={reading} />
      )}
      {tones.map((tone) => {
        const count = counts.get(tone) ?? 0;
        const name = toneLabels[tone] ?? TONE_LABELS[tone];
        const label = count > 0 ? `${name} (${formatCount(count)})` : name;
        return (
          <Tooltip key={tone} content={label}>
            <button type="button" className={styles.chip} data-tone={tone} data-empty={count === 0} aria-pressed={activeTones.has(tone)} aria-label={label} disabled={reading} onClick={() => toggle(tone)}>
              <StatusLetter letter={STATUS_LETTERS[tone]} />
            </button>
          </Tooltip>
        );
      })}
      <span className={styles.layout}>
        <FileListLayoutMenu />
      </span>
      {actions && <span className={styles.actions}>{actions}</span>}
    </div>
  );

  return { visible, query, clear, bar };
}
