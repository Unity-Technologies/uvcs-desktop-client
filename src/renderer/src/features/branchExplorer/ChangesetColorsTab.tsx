import { Palette, Plus, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { displayName, userFilterTexts } from '../../lib/userName';
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
import { usersToAdd, withUserHue, withUserRemoved, withUsersAdded, type UserColor, type UserColors } from './model/userColors';
import styles from './ChangesetColorsTab.module.css';

interface ChangesetColorsTabProps {
  colors: UserColors;
  /** Everyone who made a changeset in the history the graph shows. */
  authors: readonly string[];
  onChange: (colors: UserColors) => void;
}

/** The display options' "Changeset colors" tab: a color for each person's changesets, under the format rules' colors. */
export function ChangesetColorsTab({ colors, authors, onChange }: ChangesetColorsTabProps) {
  const addButton = <AddPeople colors={colors} authors={authors} onChange={onChange} />;
  if (colors.users.length === 0) {
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
        <Checkbox label="Color changesets by who made them" checked={colors.on} onChange={(on) => onChange({ ...colors, on })} />
        {addButton}
      </div>
      <ul className={styles.list} data-off={!colors.on || undefined}>
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

function AddPeople({ colors, authors, onChange }: ChangesetColorsTabProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      trigger={
        <Button size="small" icon={<Plus size={14} />}>
          Add people
        </Button>
      }
    >
      <AddPeopleList colors={colors} authors={authors} onChange={onChange} />
    </Popover>
  );
}

/** The people in the history without a color as the list opened (rows don't leave while picking); checked ones have one. */
function AddPeopleList({ colors, authors, onChange }: ChangesetColorsTabProps) {
  const [search, setSearch] = useState('');
  const colorsOnOpen = useRef(colors).current;
  const offered = useMemo(() => usersToAdd(authors, colorsOnOpen), [authors, colorsOnOpen]);
  const rows = useMemo(() => offered.filter((user) => matchesWordFilter(userFilterTexts(user), search)), [offered, search]);
  const isColored = (user: string): boolean => colors.users.some((color) => color.user === user);
  return (
    <FilterChecklist
      rows={rows}
      search={search}
      onSearchChange={setSearch}
      placeholder="Find people"
      label="People"
      isChecked={isColored}
      onToggle={(user) => onChange(isColored(user) ? withUserRemoved(colors, user) : withUsersAdded(colors, [user]))}
      renderRow={(user) => (
        <>
          <Avatar user={user} size={18} tip={null} />
          <span className={styles.pickName}>
            <Highlight text={displayName(user)} />
          </span>
        </>
      )}
      empty={offered.length === 0 ? <>Everyone in the graph has a color</> : <>No one matches “{search.trim()}”</>}
    />
  );
}
