import { Avatar } from '../../../ui/Avatar';
import type { SignInRow } from './connectFlow';
import { TrackerIcon } from './TrackerIcon';
import styles from './IssueTrackerPane.module.css';

/** Who a sign-in is, as its card shows it: the avatar with the tracker's logo on its corner, the name, its second line (`detail`). */
export function SignInIdentity({ row }: { row: SignInRow }) {
  return (
    <>
      <span className={styles.tileAvatar}>
        <Avatar user={row.account} size={26} tip={null} />
        <span className={styles.tileBadge}>
          <TrackerIcon kind={row.kind} size={13} />
        </span>
      </span>
      <span className={styles.tileText}>
        <span className={styles.tileName}>{row.account}</span>
        <span className={styles.tileHost}>{row.detail}</span>
      </span>
    </>
  );
}
