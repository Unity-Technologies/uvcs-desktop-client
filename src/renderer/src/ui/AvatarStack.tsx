import type { CSSProperties } from 'react';
import { Avatar } from './Avatar';
import { avatarStackLayout, type StackSlot } from './avatarStackLayout';
import styles from './AvatarStack.module.css';

export interface StackedAvatar {
  user: string;
  /** What the avatar's own tooltip says once the stack spreads. */
  tip: string;
  /** A color to ring the avatar in (`var(--status-added)`), when it stands for something; none otherwise. */
  ring?: string;
}

interface AvatarStackProps {
  avatars: readonly StackedAvatar[];
  size: number;
  /** The people left out, counted in a last disc ("+2") whose tooltip names them. */
  more?: { count: number; tip: string };
  /** What the stack says as a whole, to its tooltip and a screen reader; without one it is decoration. */
  label?: string;
}

/**
 * Avatars overlapping like a short stack of coins, the first in front. Hovered, they spread side by side, each one
 * after the one before, over what follows them (the stack keeps its resting width, so nothing beside it moves), and
 * each names itself in its own tooltip.
 */
export function AvatarStack({ avatars, size, more, label }: AvatarStackProps) {
  const { slots, restWidth, spreadWidth } = avatarStackLayout(avatars.length + (more ? 1 : 0), size);

  return (
    <span
      className={styles.stack}
      style={{ width: restWidth, height: size, '--avatar-size': `${size}px`, '--spread-width': `${spreadWidth}px` } as CSSProperties}
      data-tip={label}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {avatars.map((avatar, index) => (
        <span key={avatar.user} className={styles.item} style={slotStyle(slots[index]!, avatar.ring)} data-tip={avatar.tip}>
          <Avatar user={avatar.user} size={size} tip={null} />
        </span>
      ))}
      {more && (
        <span className={styles.item} style={slotStyle(slots[avatars.length]!)} data-tip={more.tip}>
          <span className={styles.more}>+{more.count}</span>
        </span>
      )}
    </span>
  );
}

function slotStyle(slot: StackSlot, ring?: string): CSSProperties {
  return {
    '--rest-x': `${slot.restX}px`,
    '--spread-x': `${slot.spreadX}px`,
    '--layer': slot.layer,
    '--order': slot.order,
    '--reverse-order': slot.reverseOrder,
    ...(ring && { '--avatar-ring': ring }),
  } as CSSProperties;
}
