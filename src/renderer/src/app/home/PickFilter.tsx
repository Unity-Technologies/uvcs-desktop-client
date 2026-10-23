import { useMemo, useState, type ReactNode } from 'react';
import { formatCount } from '../../lib/text';
import { FilterOptions } from '../../ui/FilterOptions';
import { FilterPopover } from '../../ui/FilterPopover';
import { Highlight } from '../../ui/Highlight';
import { PickList } from '../../ui/PickList';
import { MenuChip } from '../../ui/ToggleChip';
import styles from './Home.module.css';

const ROW_HEIGHT = 32;

/** One choice of a `PickFilter`, as its row shows it. */
export interface PickFilterRow {
  key: string;
  icon: ReactNode;
  label: string;
  /** How many things it holds: repositories, workspaces. */
  count: number;
  picked: boolean;
  /** Under the row before it: a project under its organization. */
  nested?: boolean;
}

interface PickFilterProps<Choice> {
  /** What the chip shows: the choice picked, or the one that filters nothing. */
  chip: { icon: ReactNode; label: string; active: boolean };
  /** What the filter picks, for screen readers: "Project", "Place". */
  name: string;
  /** What its rows are, for screen readers: "Projects", "Places". */
  rowsLabel: string;
  /** The choice that filters nothing, above the search: "All projects", "Everywhere". */
  all: { label: ReactNode; checked: boolean };
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
 * The home screen's filters that pick one of many by name (a Unity project, a place): a chip opening a popover with
 * the choice that filters nothing, then a search over every choice, only the rows in view rendered.
 */
export function PickFilter<Choice>({ chip, name, rowsLabel, all, choices, matching, rowOf, placeholder, empty, onPick }: PickFilterProps<Choice>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const shown = useMemo(() => matching(choices, search), [matching, choices, search]);
  const choose = (picked: Choice | null): void => {
    setOpen(false);
    setSearch('');
    onPick(picked);
  };

  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      width={320}
      trigger={
        <MenuChip icon={chip.icon} active={chip.active} aria-label={`${name}: ${chip.label}`}>
          <span className={styles.pickChipName}>{chip.label}</span>
        </MenuChip>
      }
    >
      <FilterOptions label={rowsLabel} kind="radio" options={[{ id: 'all', label: all.label, checked: all.checked, onSelect: () => choose(null) }]} />
      <PickList
        items={shown}
        itemKey={(choice) => rowOf(choice).key}
        search={search}
        onSearchChange={setSearch}
        placeholder={placeholder}
        label={rowsLabel}
        onPick={choose}
        rowHeight={ROW_HEIGHT}
        empty={empty}
        renderItem={(choice) => {
          const row = rowOf(choice);
          return (
            <span className={styles.pickChoice} data-picked={row.picked} data-nested={row.nested === true}>
              {row.icon}
              <span className={styles.pickChoiceName}>
                <Highlight text={row.label} />
              </span>
              <span className={styles.pickChoiceCount}>{formatCount(row.count)}</span>
            </span>
          );
        }}
      />
    </FilterPopover>
  );
}
