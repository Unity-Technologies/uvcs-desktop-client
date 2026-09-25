import { useAvatarImage } from '../lib/avatars/avatarImages';
import { displayName, initials, userHue } from '../lib/userName';
import { Highlight } from './Highlight';
import styles from './Avatar.module.css';

/** The user's Gravatar when they have one; otherwise their initials on a stable color. */
export function Avatar({ user, size = 20 }: { user: string; size?: number }) {
  const image = useAvatarImage(user);

  return (
    <span className={styles.avatar} data-tip={displayName(user)} style={{ width: size, height: size }}>
      {image ? (
        <img className={styles.image} src={image.src} alt="" draggable={false} />
      ) : (
        // SVG centers the letters exactly at any size, unlike text in a sized box.
        <svg viewBox="0 0 100 100" className={styles.initials} aria-hidden>
          <circle cx="50" cy="50" r="50" fill={`hsl(${userHue(user)} 55% 50%)`} />
          <text x="50" y="50" dy="0.35em" textAnchor="middle" fontSize="40" fontWeight="600" fill="#fff">
            {initials(user)}
          </text>
        </svg>
      )}
    </span>
  );
}

export function UserLabel({ user }: { user: string }) {
  return (
    <span className={styles.userLabel}>
      <Avatar user={user} size={18} />
      <span className={styles.name}>
        <Highlight text={displayName(user)} />
      </span>
    </span>
  );
}
