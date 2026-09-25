import { displayName, initials, userHue } from '../lib/userName';
import styles from './Avatar.module.css';

export function Avatar({ user, size = 20 }: { user: string; size?: number }) {
  return (
    <span
      className={styles.avatar}
      title={displayName(user)}
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${userHue(user)} 55% 52%)` }}
    >
      {initials(user)}
    </span>
  );
}

export function UserLabel({ user }: { user: string }) {
  return (
    <span className={styles.userLabel}>
      <Avatar user={user} size={18} />
      <span className={styles.name}>{displayName(user)}</span>
    </span>
  );
}
