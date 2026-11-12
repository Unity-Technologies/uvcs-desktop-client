import { Contrast, Zap, type LucideIcon } from 'lucide-react';
import type { WorkspaceKind } from '@shared/domain/workspace';
import { markedWorkspaceKind, type MarkedWorkspaceKind } from './workspaceKindWords';
import styles from './WorkspaceKindBadge.module.css';

/** A lightning for a workspace that downloads each file when first opened; half a circle for one holding only some. */
const BADGE_ICONS: Record<MarkedWorkspaceKind, LucideIcon> = {
  dynamic: Zap,
  partial: Contrast,
};

/**
 * The corner of a workspace's avatar marking its kind, for the same workspaces as its chip (`markedWorkspaceKind`), so
 * a partial or dynamic one stands out even where the chip isn't shown: the collapsed sidebar.
 */
export function WorkspaceKindBadge({ kind }: { kind: WorkspaceKind | undefined }) {
  const marked = markedWorkspaceKind(kind);
  if (!marked) return null;
  const Icon = BADGE_ICONS[marked];
  return (
    <span className={styles.badge} data-kind={marked}>
      <Icon className={styles.icon} strokeWidth={2.5} />
    </span>
  );
}
