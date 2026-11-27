import type { ComponentType, SVGProps } from 'react';
import type { WorkspaceKind } from '@shared/domain/workspace';
import { DynamicWorkspaceIcon } from './DynamicWorkspaceIcon';
import { PartialWorkspaceIcon } from './PartialWorkspaceIcon';
import { markedWorkspaceKind, type MarkedWorkspaceKind } from './workspaceKindWords';
import { BADGE_DISC, BADGE_GLYPH, BADGE_VIEW_BOX } from './workspaceKindBadgeGeometry';
import styles from './WorkspaceKindBadge.module.css';

type BadgeIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/** A bolt for a workspace that downloads each file when first opened; a half-filled circle for one holding only some. */
const BADGE_ICONS: Record<MarkedWorkspaceKind, BadgeIcon> = {
  dynamic: DynamicWorkspaceIcon,
  partial: PartialWorkspaceIcon,
};

/**
 * The corner of a workspace's avatar marking its kind, for the same workspaces as its chip (`markedWorkspaceKind`), so
 * a partial or dynamic one stands out at a glance, on its avatar wherever it shows. `compact` draws it smaller on the
 * smaller avatars, so it never hides the initial. One SVG draws the disc and the glyph, so the glyph stays centered
 * at any size and display scale (`workspaceKindBadgeGeometry`).
 */
export function WorkspaceKindBadge({ kind, compact }: { kind: WorkspaceKind | undefined; compact: boolean }) {
  const marked = markedWorkspaceKind(kind);
  if (!marked) return null;
  const Icon = BADGE_ICONS[marked];
  return (
    <svg
      className={styles.badge}
      data-kind={marked}
      data-compact={compact}
      viewBox={`0 0 ${BADGE_VIEW_BOX} ${BADGE_VIEW_BOX}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className={styles.disc}
        cx={BADGE_DISC.center}
        cy={BADGE_DISC.center}
        r={BADGE_DISC.radius}
        strokeWidth={BADGE_DISC.rim}
      />
      <Icon x={BADGE_GLYPH.x} y={BADGE_GLYPH.y} size={BADGE_GLYPH.size} />
    </svg>
  );
}
