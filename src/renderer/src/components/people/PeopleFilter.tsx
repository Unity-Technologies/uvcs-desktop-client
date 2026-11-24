import { ChevronDown, User, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { usePlaceUser } from '../../app/account/accounts';
import { describePick, othersLabel, stackedPeople, withMine, type PeoplePick } from '../../lib/peopleFilter';
import { AvatarStack } from '../../ui/AvatarStack';
import { FilterPopover } from '../../ui/FilterPopover';
import { PeoplePicker } from './PeoplePicker';
import styles from './PeopleFilter.module.css';

interface PeopleFilterProps {
  value: PeoplePick;
  onChange: (pick: PeoplePick) => void;
  /** The people the list shows or showed (`usePeopleSeen`); the picker offers them. */
  people: readonly string[];
  /** What Mine shows, for its tooltip: "Branches you created". */
  mineTip: string;
  /** The user's half, where a list picks people by another part than who created its rows ("I'm a reviewer"). */
  mine?: { label: string; icon: ReactNode };
  /** What the picker picks, for its tooltip and screen readers: "Pick people", "Pick reviewers". */
  pickLabel?: string;
}

/**
 * Whose rows a list shows, the same in every view: Mine, one click away, and beside it a picker of anyone in the list
 * (several at once), which reads who is picked ("Ana Diaz +2", their avatars stacked). A list that also picks people by
 * another part (a review's reviewers) names its own halves (`mine`, `pickLabel`).
 */
export function PeopleFilter({ value, onChange, people, mineTip, mine = { label: 'Mine', icon: <User size={13} /> }, pickLabel = 'Pick people' }: PeopleFilterProps) {
  const me = usePlaceUser();
  const others = value.others;

  return (
    <div className={styles.filter} role="group" aria-label={`People: ${describePick(value)}`}>
      <button type="button" className={styles.mine} aria-pressed={value.mine} data-tip={mineTip} onClick={() => onChange(withMine(value, !value.mine))}>
        {mine.icon}
        {mine.label}
      </button>
      <FilterPopover
        width={300}
        trigger={
          <button
            type="button"
            className={styles.others}
            aria-pressed={others.length > 0}
            aria-label={others.length > 0 ? `People: ${othersLabel(others)}` : pickLabel}
            data-tip={others.length > 0 ? describePick(value) : pickLabel}
          >
            {others.length > 0 ? (
              <>
                <span className={styles.picked}>
                  <AvatarStack avatars={stackedPeople(others)} size={16} />
                </span>
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
