import { Users } from 'lucide-react';
import styles from './GroupAvatar.module.css';

interface GroupAvatarProps {
  size?: number;
  /** The tooltip; none by default, where the row names the group beside it. */
  tip?: string;
}

/** A group where a user shows their avatar (a reviewer group): a neutral disc with the group icon, the size of an `Avatar`. */
export function GroupAvatar({ size = 20, tip }: GroupAvatarProps) {
  return (
    <span className={styles.group} style={{ width: size, height: size }} data-tip={tip} aria-hidden>
      <Users size={Math.round(size * 0.6)} />
    </span>
  );
}
