import { Check, ChevronDown } from 'lucide-react';
import { forwardRef, useMemo, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { FilterPopover } from '../../ui/FilterPopover';
import { Highlight } from '../../ui/Highlight';
import { PickList } from '../../ui/PickList';
import { pickFilterItems, type PickFilterItem } from './pickFilterItems';
import styles from './PickFilter.module.css';

const ROW_HEIGHT = 32;

/** One choice of a `PickFilter`, as its row shows it. */
export interface PickFilterRow {
  key: string;
  icon: ReactNode;
  label: string;
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
  /** The choice that filters nothing, the list's first row: "All projects", "Everywhere". */
  all: { icon?: ReactNode; label: string; picked: boolean };
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
 * opening a popover with a search across its top, then the choice that filters nothing and every choice, the one
 * picked checked, only the rows in view rendered.
 */
export function PickFilter<Choice>({ trigger, name, rowsLabel, all, choices, matching, rowOf, placeholder, empty, onPick }: PickFilterProps<Choice>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const items = useMemo(() => pickFilterItems(matching(choices, search), search), [matching, choices, search]);
  const choose = (item: PickFilterItem<Choice>): void => {
    setOpen(false);
    setSearch('');
    onPick(item.kind === 'all' ? null : item.choice);
  };
  const rowOfItem = (item: PickFilterItem<Choice>): PickFilterRow =>
    item.kind === 'all' ? { key: '\u0000all', icon: all.icon, label: all.label, picked: all.picked } : rowOf(item.choice);

  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      width={320}
      trigger={<PickTrigger icon={trigger.icon} label={trigger.label} aria-label={`${name}: ${trigger.label}`} />}
    >
      <PickList
        inPopover
        items={items}
        itemKey={(item) => rowOfItem(item).key}
        search={search}
        onSearchChange={setSearch}
        placeholder={placeholder}
        label={rowsLabel}
        onPick={choose}
        rowHeight={ROW_HEIGHT}
        empty={empty}
        renderItem={(item) => {
          const row = rowOfItem(item);
          return (
            <span className={styles.choice} data-nested={row.nested === true} data-all={item.kind === 'all'}>
              <span className={styles.check}>{row.picked && <Check size={14} />}</span>
              {row.icon}
              <span className={styles.choiceName}>{item.kind === 'all' ? row.label : <Highlight text={row.label} />}</span>
            </span>
          );
        }}
      />
    </FilterPopover>
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
