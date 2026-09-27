import { useMemo, useState, type ReactNode } from 'react';
import { formatCount } from '../lib/text';
import { SearchField } from '../ui/SearchField';
import { Tooltip } from '../ui/Tooltip';
import { countTones, matchesChangeFilter, offeredTones } from './changeFilter';
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

interface ChangeFilterResult<T> {
  visible: T[];
  /** The text typed, for highlighting matches. */
  query: string;
  /** Empties the text and turns every status chip off. */
  clear: () => void;
  /** The filter field followed by one toggle chip per status. */
  bar: ReactNode;
}

/** Filters a list of changed files by path and by status (A, M, D, R...). */
export function useChangeFilter<T>(items: T[], pathOf: (item: T) => string, toneOf: (item: T) => StatusTone): ChangeFilterResult<T> {
  const [query, setQuery] = useState('');
  const [chosenTones, setChosenTones] = useState<ReadonlySet<StatusTone>>(new Set());

  const counts = useMemo(() => countTones(items.map(toneOf)), [items, toneOf]);
  const tones = useMemo(() => offeredTones(new Set(counts.keys())), [counts]);
  // A chip can go away while chosen (the last private file is added); never keep filtering by a hidden chip.
  const activeTones = useMemo(() => new Set([...chosenTones].filter((tone) => tones.includes(tone))), [chosenTones, tones]);
  const visible = useMemo(
    () => items.filter((item) => matchesChangeFilter(pathOf(item), toneOf(item), { query, tones: activeTones })),
    [items, pathOf, toneOf, query, activeTones],
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

  const bar = (
    <div className={styles.bar}>
      <SearchField value={query} onChange={setQuery} placeholder={`Filter ${formatCount(items.length)} files`} width="100%" />
      {tones.map((tone) => {
        const count = counts.get(tone) ?? 0;
        const label = count > 0 ? `${TONE_LABELS[tone]} (${formatCount(count)})` : TONE_LABELS[tone];
        return (
          <Tooltip key={tone} content={label}>
            <button type="button" className={styles.chip} data-tone={tone} data-empty={count === 0} aria-pressed={activeTones.has(tone)} aria-label={label} onClick={() => toggle(tone)}>
              <StatusLetter letter={STATUS_LETTERS[tone]} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );

  return { visible, query, clear, bar };
}
