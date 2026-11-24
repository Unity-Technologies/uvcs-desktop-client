import type { ComponentType, SVGProps } from 'react';
import type { WorkspaceKind } from '@shared/domain/workspace';
import { DynamicWorkspaceIcon } from './DynamicWorkspaceIcon';
import { PartialWorkspaceIcon } from './PartialWorkspaceIcon';
import { markedWorkspaceKind, type MarkedWorkspaceKind } from './workspaceKindWords';
import styles from './WorkspaceKindBadge.module.css';

/** A bolt for a workspace that downloads each file when first opened; a half-filled circle for one holding only some. */
const BADGE_ICONS: Record<MarkedWorkspaceKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  dynamic: DynamicWorkspaceIcon,
  partial: PartialWorkspaceIcon,
};

/**
 * The corner of a workspace's avatar marking its kind, for the same workspaces as its chip (`markedWorkspaceKind`), so
 * a partial or dynamic one stands out even where the chip isn't shown: the collapsed sidebar. `compact` draws it smaller
 * on the smaller avatars, so it never hides the initial.
 */
export function WorkspaceKindBadge({ kind, compact }: { kind: WorkspaceKind | undefined; compact: boolean }) {
  const marked = markedWorkspaceKind(kind);
  if (!marked) return null;
  const Icon = BADGE_ICONS[marked];
  return (
    <span className={styles.badge} data-kind={marked} data-compact={compact}>
      <Icon className={styles.icon} />
    </span>
  );
}
