import type { CSSProperties } from 'react';
import { classNames } from '../lib/classNames';
import { initialOf } from '../lib/initialOf';
import { avatarColor } from './avatarColor';
import styles from './RepositoryAvatar.module.css';

interface RepositoryAvatarProps {
  /** `name@server` or a repository's name; while unknown, the color is the label's. */
  repository: string | null | undefined;
  /** Whose initial it shows: a workspace's own name, or the repository's; undefined while loading, a neutral square. */
  label: string | undefined;
  size: 24 | 28 | 32;
  className?: string;
}

/**
 * A white initial on the repository's own solid color, the same on the home screen, in the switcher and on the
 * sidebar's workspace button, so workspaces of the same repository look alike at a glance.
 */
export function RepositoryAvatar({ repository, label, size, className }: RepositoryAvatarProps) {
  const fill = label === undefined ? undefined : `var(${avatarColor(repository, label)})`;
  return (
    <span
      className={classNames(styles.avatar, className)}
      data-size={size}
      data-loading={label === undefined}
      style={{ '--avatar-fill': fill } as CSSProperties}
      aria-hidden
    >
      {label !== undefined && <span className={styles.letter}>{initialOf(label)}</span>}
    </span>
  );
}
