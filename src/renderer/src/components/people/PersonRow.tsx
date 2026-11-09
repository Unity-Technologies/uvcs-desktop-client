import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import styles from './PersonRow.module.css';

interface PersonRowProps {
  user: string;
  /** What the row calls them ("You"); their name as shown otherwise. */
  name?: string;
}

/**
 * A person in a picker's row: their avatar, their name, then the name as stored when it reads differently, both
 * marked where the search matched (`Highlight`).
 */
export function PersonRow({ user, name = displayName(user) }: PersonRowProps) {
  const stored = storedName(user, name);
  return (
    <>
      <Avatar user={user} size={18} tip={null} />
      <span className={styles.name}>
        <Highlight text={name} />
      </span>
      {stored && (
        <span className={styles.stored}>
          <Highlight text={stored} />
        </span>
      )}
    </>
  );
}

/** What a row adds after the name it shows: the name as shown when it calls them otherwise ("You"), else as stored. */
function storedName(user: string, name: string): string | undefined {
  if (name !== displayName(user)) return displayName(user);
  return name.toLowerCase() !== user.toLowerCase() ? user : undefined;
}
