import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Avatar } from './Avatar';
import { avatarStackLayout, type StackSlot } from './avatarStackLayout';
import { GroupAvatar } from './GroupAvatar';
import styles from './AvatarStack.module.css';

export interface StackedAvatar {
  user: string;
  /** What the avatar's own tooltip says once the stack spreads. */
  tip: string;
  /** What the avatar stands for, in its corner once the stack spreads: an icon in a color (`var(--status-added)`). */
  badge?: { icon: LucideIcon; color: string };
  /** A group, not a person: its icon instead of an avatar. */
  group?: boolean;
}

interface AvatarStackProps {
  avatars: readonly StackedAvatar[];
  size: number;
  /** The people left out, counted in a last disc ("+2") whose tooltip names them. */
  more?: { count: number; tip: string };
  /**
   * What the stack says as a whole to a screen reader; without one it is decoration. It is no tooltip: the pointer
   * reads each avatar's own, and "+N"'s names the rest.
   */
  label?: string;
}

/**
 * Avatars overlapping like a short stack of coins, the first in front. Hovered, they spread side by side, each one
 * after the one before, over what follows them (the stack keeps its resting width, so nothing beside it moves), and
 * each names itself in its own tooltip. A badge (a reviewer's status) shows in each avatar's corner only once spread:
 * at rest the stack says who, spread it says where each stands.
 */
export function AvatarStack({ avatars, size, more, label }: AvatarStackProps) {
  const { slots, restWidth, spreadWidth } = avatarStackLayout(avatars.length + (more ? 1 : 0), size);

  return (
    <span
      className={styles.stack}
      style={{ width: restWidth, height: size, '--avatar-size': `${size}px`, '--spread-width': `${spreadWidth}px` } as CSSProperties}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {avatars.map((avatar, index) => (
        <span key={avatar.user} className={styles.item} style={slotStyle(slots[index]!)} data-tip={avatar.tip}>
          {avatar.group ? <GroupAvatar size={size} /> : <Avatar user={avatar.user} size={size} tip={null} />}
          {avatar.badge && (
            <span className={styles.badge} style={{ '--badge-color': avatar.badge.color } as CSSProperties}>
              <avatar.badge.icon size={7} strokeWidth={3} aria-hidden />
            </span>
          )}
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

function slotStyle(slot: StackSlot): CSSProperties {
  return {
    '--rest-x': `${slot.restX}px`,
    '--spread-x': `${slot.spreadX}px`,
    '--layer': slot.layer,
    '--order': slot.order,
    '--reverse-order': slot.reverseOrder,
  } as CSSProperties;
}
