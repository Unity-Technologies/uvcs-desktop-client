import type { CSSProperties } from 'react';
import { avatarColorOf } from '../lib/avatarColors';
import { useAvatarImage } from '../lib/avatars/avatarImages';
import { displayName, initials } from '../lib/userName';
import { Highlight } from './Highlight';
import styles from './Avatar.module.css';

/** The user's Gravatar when they have one; otherwise their white initials on their own avatar fill (`avatarColorOf`). The tooltip is their name unless `tip` says otherwise (null: none). */
export function Avatar({ user, size = 20, tip = displayName(user) }: { user: string; size?: number; tip?: string | null }) {
  const image = useAvatarImage(user);

  return (
    <span className={styles.avatar} data-tip={tip ?? undefined} style={{ width: size, height: size }}>
      {image ? (
        <img className={styles.image} src={image.src} alt="" draggable={false} />
      ) : (
        // SVG centers the letters exactly at any size, unlike text in a sized box.
        <svg viewBox="0 0 100 100" className={styles.initials} style={{ '--avatar-fill': `var(${avatarColorOf(user)})` } as CSSProperties} aria-hidden>
          <circle cx="50" cy="50" r="50" />
          <text x="50" y="50" dy="0.35em" textAnchor="middle" fontSize="40" fontWeight="600">
            {initials(user)}
          </text>
        </svg>
      )}
    </span>
  );
}

export function UserLabel({ user, avatar = true }: { user: string; /** Off where the row already leads with the avatar. */ avatar?: boolean }) {
  return (
    <span className={styles.userLabel}>
      {avatar && <Avatar user={user} size={18} />}
      <span className={styles.name}>
        <Highlight text={displayName(user)} />
      </span>
    </span>
  );
}
