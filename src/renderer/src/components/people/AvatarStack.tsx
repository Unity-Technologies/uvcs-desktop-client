import { Avatar } from '../../ui/Avatar';
import styles from './PeopleFilter.module.css';

const SHOWN = 3;

/** The first few people picked, their avatars overlapping. */
export function AvatarStack({ users }: { users: readonly string[] }) {
  return (
    <span className={styles.stack} aria-hidden>
      {users.slice(0, SHOWN).map((user) => (
        <span key={user} className={styles.stacked}>
          <Avatar user={user} size={16} tip={null} />
        </span>
      ))}
    </span>
  );
}
