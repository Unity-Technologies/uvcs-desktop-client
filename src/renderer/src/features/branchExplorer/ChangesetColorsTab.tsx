import { Palette, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { EmptyState } from '../../ui/EmptyState';
import { FilterChecklist } from '../../ui/FilterChecklist';
import { Highlight } from '../../ui/Highlight';
import { IconButton } from '../../ui/IconButton';
import { Popover } from '../../ui/Popover';
import { HueDot } from './HueDot';
import { HuePicker } from './HuePicker';
import {
  addingTurnsColorsOn,
  addPeopleEmpty,
  changesetColorsTabBody,
  isColored,
  peopleMatching,
  usersToAdd,
  withUserHue,
  withUserRemoved,
  withUserToggled,
  type UserColor,
  type UserColors,
} from './model/userColors';
import styles from './ChangesetColorsTab.module.css';

interface ChangesetColorsTabProps {
  colors: UserColors;
  /** Whether the colors apply in the window's repository. Off keeps them and colors nothing there. */
  on: boolean;
  /** Everyone who made a changeset in the history the graph shows. */
  authors: readonly string[];
  onChange: (colors: UserColors) => void;
  onTurn: (on: boolean) => void;
}

/** The display options' "Changeset colors" tab: a color for each person's changesets, under the format rules' colors. */
export function ChangesetColorsTab({ colors, on, authors, onChange, onTurn }: ChangesetColorsTabProps) {
  // The colors as the list of people opened, kept here: adding the first person swaps the empty state for the list, and
  // the list of people stays open across it.
  const [addingFrom, setAddingFrom] = useState<UserColors | null>(null);
  const addButton = (
    <AddPeople
      colors={colors}
      on={on}
      authors={authors}
      onChange={onChange}
      onTurn={onTurn}
      addingFrom={addingFrom}
      onAddingFrom={setAddingFrom}
    />
  );
  const body = changesetColorsTabBody(colors, on);
  if (body.state === 'empty') {
    return (
      <EmptyState
        icon={<Palette size={20} />}
        title="No changeset colors"
        description="Give each person a color, and their changesets take it."
        action={addButton}
      />
    );
  }
  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <Checkbox label="Color changesets by who made them" checked={on} onChange={onTurn} />
        {addButton}
      </div>
      <ul className={styles.list} data-off={body.dimmed || undefined}>
        {colors.users.map((color) => (
          <PersonRow
            key={color.user}
            color={color}
            onHue={(hue) => onChange(withUserHue(colors, color.user, hue))}
            onRemove={() => onChange(withUserRemoved(colors, color.user))}
          />
        ))}
      </ul>
    </div>
  );
}

function PersonRow({ color, onHue, onRemove }: { color: UserColor; onHue: (hue: number) => void; onRemove: () => void }) {
  const name = displayName(color.user);
  return (
    <li className={styles.row}>
      <Popover
        trigger={
          <button type="button" className={styles.hue} aria-label={`Color of ${name}`}>
            <HueDot hue={color.hue} size={12} />
          </button>
        }
        width={236}
      >
        <HuePicker hue={color.hue} onChange={onHue} />
      </Popover>
      <Avatar user={color.user} size={20} tip={null} />
      <span className={styles.name} title={color.user}>
        {name}
      </span>
      <IconButton icon={<Trash2 size={14} />} label={`Remove ${name}`} size="small" onClick={onRemove} />
    </li>
  );
}

interface AddPeopleProps extends ChangesetColorsTabProps {
  /** The colors as the list opened; null while it's closed. */
  addingFrom: UserColors | null;
  onAddingFrom: (colors: UserColors | null) => void;
}

function AddPeople({ addingFrom, onAddingFrom, ...tab }: AddPeopleProps) {
  return (
    <Popover
      open={addingFrom !== null}
      onOpenChange={(open) => onAddingFrom(open ? tab.colors : null)}
      align="end"
      trigger={
        <Button size="small" icon={<Plus size={14} />}>
          Add people
        </Button>
      }
    >
      <AddPeopleList {...tab} colorsOnOpen={addingFrom ?? tab.colors} />
    </Popover>
  );
}

/** The people in the history without a color as the list opened (rows don't leave while picking); checked ones have one. */
function AddPeopleList({ colors, on, authors, onChange, onTurn, colorsOnOpen }: ChangesetColorsTabProps & { colorsOnOpen: UserColors }) {
  const [search, setSearch] = useState('');
  const offered = useMemo(() => usersToAdd(authors, colorsOnOpen), [authors, colorsOnOpen]);
  const rows = useMemo(() => peopleMatching(offered, search), [offered, search]);
  const empty = addPeopleEmpty(offered, search);
  return (
    <FilterChecklist
      rows={rows}
      search={search}
      onSearchChange={setSearch}
      placeholder="Find people"
      label="People"
      isChecked={(user) => isColored(colors, user)}
      onToggle={(user) => {
        onChange(withUserToggled(colors, user));
        if (addingTurnsColorsOn(colors, on)) onTurn(true);
      }}
      renderRow={(user) => (
        <>
          <Avatar user={user} size={18} tip={null} />
          <span className={styles.pickName}>
            <Highlight text={displayName(user)} />
          </span>
        </>
      )}
      empty={empty.kind === 'everyoneColored' ? <>Everyone in the graph has a color</> : <>No one matches “{empty.search}”</>}
    />
  );
}
