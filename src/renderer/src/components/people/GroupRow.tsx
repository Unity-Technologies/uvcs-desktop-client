import { GroupAvatar } from '../../ui/GroupAvatar';
import { Highlight } from '../../ui/Highlight';
import styles from './GroupRow.module.css';

/** A group in a picker's row, beside people (`PersonRow`): the group icon where they show an avatar, then its name as the server names it, marked where the search matched. */
export function GroupRow({ group }: { group: string }) {
  return (
    <>
      <GroupAvatar size={18} />
      <span className={styles.name}>
        <Highlight text={group} />
      </span>
      <span className={styles.kind}>Group</span>
    </>
  );
}
