import { Check, ChevronDown } from 'lucide-react';
import { forwardRef, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { FilterPopover } from '../../ui/FilterPopover';
import { Highlight } from '../../ui/Highlight';
import { PickList } from '../../ui/PickList';
import styles from './PickFilter.module.css';

/** A name over a quiet line, as the branch lists' rows are. */
const ROW_HEIGHT = 44;

/** One choice of a `PickFilter`, as its row shows it. */
export interface PickFilterRow {
  key: string;
  icon: ReactNode;
  label: string;
  /** The quiet line under the label: what it holds ("4 repositories"). */
  detail: string;
  picked: boolean;
  /** Under the row before it: a project under its organization. */
  nested?: boolean;
}

interface PickFilterProps<Choice> {
  /** What the trigger shows: the choice picked, or the one that filters nothing. */
  trigger: { icon: ReactNode; label: string };
  /** What the filter picks, for screen readers: "Project", "Place". */
  name: string;
  /** What its rows are, for screen readers: "Projects", "Places". */
  rowsLabel: string;
  /** The choice that filters nothing ("All projects", "Everywhere"), pinned above the choices. */
  all: Omit<PickFilterRow, 'key' | 'nested'>;
  choices: readonly Choice[];
  /** The choices `search` finds, in the order the list shows them. */
  matching: (choices: readonly Choice[], search: string) => Choice[];
  rowOf: (choice: Choice) => PickFilterRow;
  placeholder: string;
  empty: string;
  /** The choice picked, or none for the one that filters nothing. */
  onPick: (choice: Choice | null) => void;
}

/**
 * The home screen's pickers of one of many by name (a Unity project, a place): a field-like button showing the choice,
 * opening a popover with a search across its top, the choice that filters nothing pinned under it, then every choice
 * the search finds, the one picked checked, only the rows in view rendered.
 */
export function PickFilter<Choice>({ trigger, name, rowsLabel, all, choices, matching, rowOf, placeholder, empty, onPick }: PickFilterProps<Choice>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const shown = useMemo(() => matching(choices, search), [matching, choices, search]);
  const choose = (choice: Choice | null): void => {
    setOpen(false);
    setSearch('');
    onPick(choice);
  };

  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      width={320}
      trigger={<PickTrigger icon={trigger.icon} label={trigger.label} aria-label={`${name}: ${trigger.label}`} />}
    >
      <PickList
        inPopover
        items={shown}
        itemKey={(choice) => rowOf(choice).key}
        search={search}
        onSearchChange={setSearch}
        placeholder={placeholder}
        label={rowsLabel}
        onPick={choose}
        rowHeight={ROW_HEIGHT}
        empty={empty}
        note={
          <div className={styles.pinned}>
            <button type="button" className={styles.all} role="menuitemradio" aria-checked={all.picked} onClick={() => choose(null)}>
              <PickRow row={all} />
            </button>
          </div>
        }
        renderItem={(choice) => <PickRow row={rowOf(choice)} highlighted />}
      />
    </FilterPopover>
  );
}

/** A choice's row: the check's column, its icon, its name over what it holds. */
function PickRow({ row, highlighted = false }: { row: Omit<PickFilterRow, 'key'>; highlighted?: boolean }) {
  return (
    <span className={styles.choice} data-nested={row.nested === true}>
      <span className={styles.check}>{row.picked && <Check size={14} />}</span>
      {row.icon}
      <span className={styles.text}>
        <span className={styles.label}>{highlighted ? <Highlight text={row.label} /> : row.label}</span>
        <span className={styles.detail}>{row.detail}</span>
      </span>
    </span>
  );
}

interface PickTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

/** The picker's button: shaped as the search field beside it, the choice's icon and name, a chevron. */
const PickTrigger = forwardRef<HTMLButtonElement, PickTriggerProps>(function PickTrigger({ icon, label, ...rest }, ref) {
  return (
    <button ref={ref} type="button" className={styles.trigger} {...rest}>
      {icon}
      <span className={styles.triggerLabel}>{label}</span>
      <ChevronDown size={13} className={styles.chevron} />
    </button>
  );
});
