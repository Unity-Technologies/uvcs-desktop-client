import { useMemo, useRef, useState } from 'react';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { EVERYONE, isEveryone, MAX_PICKED_PEOPLE, MINE, offeredPeople, onlyPerson, togglePerson, withMine, type PeoplePick } from '../../lib/peopleFilter';
import { displayName, userFilterTexts } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { FilterChecklist } from '../../ui/FilterChecklist';
import { Highlight } from '../../ui/Highlight';
import styles from './PeopleFilter.module.css';

/** The rows that aren't people by name; no user name holds a control character. */
const EVERYONE_ROW = '\u0000everyone';
const ME_ROW = '\u0000me';

interface PeoplePickerProps {
  value: PeoplePick;
  onChange: (pick: PeoplePick) => void;
  people: readonly string[];
  me: string | undefined;
}

/**
 * The people filter's popover: Everyone and You at the top, then everyone else in the list, those picked first as the
 * popover opened (rows don't jump while picking). Typing finds people by the name shown or as stored.
 */
export function PeoplePicker({ value, onChange, people, me }: PeoplePickerProps) {
  const [search, setSearch] = useState('');
  const pickedOnOpen = useRef(value).current;
  const offered = useMemo(() => offeredPeople(people, pickedOnOpen, me), [people, pickedOnOpen, me]);
  const meTexts = useMemo(() => ['You', ...(me ? [displayName(me)] : [])], [me]);

  const rows = useMemo(() => {
    if (!search.trim()) return [EVERYONE_ROW, ME_ROW, ...offered];
    const matching = offered.filter((user) => matchesWordFilter(userFilterTexts(user), search));
    return matchesWordFilter(meTexts, search) ? [ME_ROW, ...matching] : matching;
  }, [offered, search, meTexts]);

  const isChecked = (row: string): boolean => (row === EVERYONE_ROW ? isEveryone(value) : row === ME_ROW ? value.mine : value.others.includes(row));
  const toggle = (row: string): void => {
    if (row === EVERYONE_ROW) onChange(EVERYONE);
    else if (row === ME_ROW) onChange(withMine(value, !value.mine));
    else onChange(togglePerson(value, row, me));
  };
  const only = (row: string): void => onChange(row === EVERYONE_ROW ? EVERYONE : row === ME_ROW ? MINE : onlyPerson(row, me));
  const full = value.others.length >= MAX_PICKED_PEOPLE;

  return (
    <FilterChecklist
      rows={rows}
      search={search}
      onSearchChange={setSearch}
      placeholder="Find people"
      label="People"
      isChecked={isChecked}
      onToggle={toggle}
      onOnly={only}
      renderRow={(row) =>
        row === EVERYONE_ROW ? (
          <span className={styles.everyone}>Everyone</span>
        ) : row === ME_ROW ? (
          <>
            {me && <Avatar user={me} size={18} tip={null} />}
            <span className={styles.name}>
              <Highlight text="You" />
            </span>
            {me && (
              <span className={styles.stored}>
                <Highlight text={displayName(me)} />
              </span>
            )}
          </>
        ) : (
          <>
            <Avatar user={row} size={18} tip={null} />
            <span className={styles.name}>
              <Highlight text={displayName(row)} />
            </span>
            {displayName(row).toLowerCase() !== row.toLowerCase() && (
              <span className={styles.stored}>
                <Highlight text={row} />
              </span>
            )}
          </>
        )
      }
      summary={
        !isEveryone(value) ? (
          <>
            <span>{full ? `${MAX_PICKED_PEOPLE} people at most` : pickedCount(value)}</span>
            <button type="button" className={styles.clear} onClick={() => onChange(EVERYONE)}>
              Clear
            </button>
          </>
        ) : undefined
      }
      empty={<>No one matches “{search.trim()}”</>}
      footer={offered.length === 0 && !search.trim() ? 'Others show here once the list shows everyone’s rows.' : undefined}
    />
  );
}

function pickedCount(pick: PeoplePick): string {
  const count = pick.others.length + (pick.mine ? 1 : 0);
  return count === 1 ? '1 person picked' : `${count} people picked`;
}
