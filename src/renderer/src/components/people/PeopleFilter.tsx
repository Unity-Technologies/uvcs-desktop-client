import { ChevronDown, User, Users } from 'lucide-react';
import { useWorkspaceUser } from '../../app/account/accounts';
import { describePick, othersLabel, withMine, type PeoplePick } from '../../lib/peopleFilter';
import { FilterPopover } from '../../ui/FilterPopover';
import { AvatarStack } from './AvatarStack';
import { PeoplePicker } from './PeoplePicker';
import styles from './PeopleFilter.module.css';

interface PeopleFilterProps {
  value: PeoplePick;
  onChange: (pick: PeoplePick) => void;
  /** The people the list shows or showed (`usePeopleSeen`); the picker offers them. */
  people: readonly string[];
  /** What Mine shows, for its tooltip: "Branches you created". */
  mineTip: string;
}

/**
 * Whose rows a list shows, the same in every view: Mine, one click away, and beside it a picker of anyone in the list
 * (several at once), which reads who is picked ("Ana Diaz +2", their avatars stacked).
 */
export function PeopleFilter({ value, onChange, people, mineTip }: PeopleFilterProps) {
  const me = useWorkspaceUser();
  const others = value.others;

  return (
    <div className={styles.filter} role="group" aria-label={`People: ${describePick(value)}`}>
      <button type="button" className={styles.mine} aria-pressed={value.mine} data-tip={mineTip} onClick={() => onChange(withMine(value, !value.mine))}>
        <User size={13} />
        Mine
      </button>
      <FilterPopover
        width={300}
        trigger={
          <button
            type="button"
            className={styles.others}
            aria-pressed={others.length > 0}
            aria-label={others.length > 0 ? `People: ${othersLabel(others)}` : 'Pick people'}
            data-tip={others.length > 0 ? describePick(value) : 'Pick people'}
          >
            {others.length > 0 ? (
              <>
                <AvatarStack users={others} />
                <span className={styles.othersLabel}>{othersLabel(others)}</span>
              </>
            ) : (
              <Users size={13} />
            )}
            <ChevronDown size={12} className={styles.chevron} />
          </button>
        }
      >
        <PeoplePicker value={value} onChange={onChange} people={people} me={me} />
      </FilterPopover>
    </div>
  );
}
