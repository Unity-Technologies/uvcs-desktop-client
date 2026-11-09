import type { LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { formatCount } from '../lib/text';
import { FilterField } from '../ui/FilterField';
import { SearchField } from '../ui/SearchField';
import { Tooltip } from '../ui/Tooltip';
import type { FileListViewOffer } from './fileListViewMenuModel';
import { FileListViewMenu } from './FileListViewMenu';
import { changeFilterPlaceholder, countTones, filtersNothing, matchesChangeFilter, offeredTones, TONE_LABELS } from './changeFilter';
import { STATUS_LETTERS, StatusLetter, type StatusTone } from './StatusBadge';
import styles from './useChangeFilter.module.css';

export interface ChangeFilterOptions<T> {
  /** The list a view or page works on (Changes, a diff's files): its field takes ⌘F as every view's filter does. */
  isViewFilter?: boolean;
  /** Words a chip as the list's groups do (Incoming's "Conflicts with your changes"). */
  toneLabels?: Partial<Record<StatusTone, string>>;
  /** At the row's end, after the view menu: the list's own modes (the review mode toggle). */
  actions?: ReactNode;
  /** The groupings the list's view menu offers (`FileListViewMenu`): by status unless said otherwise. */
  viewOffer?: FileListViewOffer;
  /** Changes' grouping by changelist turned on or off, from its view menu. */
  onChangelistsChange?: (on: boolean) => void;
  /** The items are still being read: the field doesn't count them yet, and waits for them to filter anything. */
  reading?: boolean;
  /** A chip after the statuses' showing only the items a place flags (a review's "Commented" files). */
  flag?: ListFlag<T>;
}

/** What the place flags in the list, for its chip: its icon, its name, and whether an item has it. */
export interface ListFlag<T> {
  icon: LucideIcon;
  label: string;
  holds: (item: T) => boolean;
}

const NO_TONE_LABELS: Partial<Record<StatusTone, string>> = {};
const BY_STATUS: FileListViewOffer = { statusGroups: true };

export interface ChangeFilterResult<T> {
  visible: T[];
  /** The text typed, for highlighting matches. */
  query: string;
  /** Empties the text and turns every status chip off. */
  clear: () => void;
  /** The filter field followed by one toggle chip per status, the view menu (`FileListViewMenu`) and the list's `actions`. */
  bar: ReactNode;
}

/**
 * Filters a list of changed files by path and by status (A, M, D, R...), each file found by any of its statuses
 * (`statusTones`: a moved file that changed by C and M). Its bar also holds the view menu every list of
 * changed files shares, at the same place in each.
 */
export function useChangeFilter<T>(
  items: T[],
  pathOf: (item: T) => string,
  tonesOf: (item: T) => readonly StatusTone[],
  { isViewFilter = false, toneLabels = NO_TONE_LABELS, actions, reading = false, viewOffer = BY_STATUS, onChangelistsChange, flag }: ChangeFilterOptions<T> = {},
): ChangeFilterResult<T> {
  const [query, setQuery] = useState('');
  const [chosenTones, setChosenTones] = useState<ReadonlySet<StatusTone>>(new Set());
  const [chosenFlag, setChosenFlag] = useState(false);

  const counts = useMemo(() => countTones(items.map(tonesOf)), [items, tonesOf]);
  const tones = useMemo(() => offeredTones(new Set(counts.keys())), [counts]);
  // A chip can go away while chosen (the last private file is added); never keep filtering by a hidden chip.
  const activeTones = useMemo(() => new Set([...chosenTones].filter((tone) => tones.includes(tone))), [chosenTones, tones]);
  const holds = flag?.holds;
  const flaggedCount = useMemo(() => (holds ? items.filter(holds).length : 0), [items, holds]);
  // The chip goes with the flag (another diff, no review); never keep filtering by it then.
  const onlyFlagged = chosenFlag && holds !== undefined;
  const visible = useMemo(() => {
    const filter = { query, tones: activeTones, onlyFlagged };
    // Nothing to filter by keeps the very list: what is worked out from it isn't worked out again.
    if (filtersNothing(filter)) return items;
    return items.filter((item) => matchesChangeFilter(pathOf(item), tonesOf(item), filter, holds?.(item) ?? false));
  }, [items, pathOf, tonesOf, query, activeTones, onlyFlagged, holds]);

  const clear = (): void => {
    setQuery('');
    setChosenTones(new Set());
    setChosenFlag(false);
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
      {flag && <FlagChip flag={flag} count={flaggedCount} pressed={onlyFlagged} disabled={reading} onToggle={() => setChosenFlag(!chosenFlag)} />}
      <span className={styles.layout}>
        <FileListViewMenu offer={viewOffer} onChangelistsChange={onChangelistsChange} />
      </span>
      {actions && <span className={styles.actions}>{actions}</span>}
    </div>
  );

  return { visible, query, clear, bar };
}

interface FlagChipProps {
  flag: Pick<ListFlag<unknown>, 'icon' | 'label'>;
  count: number;
  pressed: boolean;
  disabled: boolean;
  onToggle: () => void;
}

/** The flag's chip, beside the statuses' and alike: "Commented (3)" in its tooltip, faint while nothing is flagged. */
function FlagChip({ flag: { icon: Icon, label }, count, pressed, disabled, onToggle }: FlagChipProps) {
  const tip = count > 0 ? `${label} (${formatCount(count)})` : label;
  return (
    <Tooltip content={tip}>
      <button type="button" className={styles.chip} data-tone="flag" data-empty={count === 0} aria-pressed={pressed} aria-label={tip} disabled={disabled} onClick={onToggle}>
        <Icon size={12} aria-hidden />
      </button>
    </Tooltip>
  );
}
