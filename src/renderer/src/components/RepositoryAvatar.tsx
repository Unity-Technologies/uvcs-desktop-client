import type { CSSProperties } from 'react';
import type { WorkspaceKind } from '@shared/domain/workspace';
import { classNames } from '../lib/classNames';
import { initialOf } from '../lib/initialOf';
import { avatarColor } from './avatarColor';
import { WorkspaceKindBadge } from './WorkspaceKindBadge';
import styles from './RepositoryAvatar.module.css';

interface RepositoryAvatarProps {
  /** `name@server` or a repository's name; while unknown, the color is the label's. */
  repository: string | null | undefined;
  /** Whose initial it shows: a workspace's own name, or the repository's; undefined while loading, a neutral square. */
  label: string | undefined;
  size: 24 | 28 | 32;
  /** A workspace's kind, once read: a badge in the corner unless standard (`WorkspaceKindBadge`). */
  workspaceKind?: WorkspaceKind;
  className?: string;
}

/**
 * A white initial on the repository's own solid color, the same on the home screen, in the switcher and on the
 * sidebar's workspace button, so workspaces of the same repository look alike at a glance; a partial or dynamic
 * workspace's carries its kind in a corner.
 */
export function RepositoryAvatar({ repository, label, size, workspaceKind, className }: RepositoryAvatarProps) {
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
      <WorkspaceKindBadge kind={workspaceKind} />
    </span>
  );
}
