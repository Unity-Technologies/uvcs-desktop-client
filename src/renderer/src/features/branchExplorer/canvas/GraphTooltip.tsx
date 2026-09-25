import { displayName } from '../../../lib/userName';
import { formatRelativeDate } from '../../../lib/formatDate';
import type { GraphLayout } from '../model/layoutGraph';
import { MERGE_LINK_NAMES } from '../model/mergeLinkNames';
import type { GraphTarget } from './graphTargets';
import styles from './GraphTooltip.module.css';

interface GraphTooltipProps {
  target: GraphTarget;
  layout: GraphLayout;
  x: number;
  y: number;
}

export function GraphTooltip({ target, layout, x, y }: GraphTooltipProps) {
  const content = tooltipContent(target, layout);
  if (!content) return null;

  return (
    <div className={styles.tooltip} style={{ left: x + 14, top: y + 14 }}>
      <div className={styles.title}>{content.title}</div>
      {content.body && <div className={styles.body}>{content.body}</div>}
      {content.meta && <div className={styles.meta}>{content.meta}</div>}
    </div>
  );
}

function tooltipContent(target: GraphTarget, layout: GraphLayout): { title: string; body?: string; meta?: string } | null {
  switch (target.kind) {
    case 'changeset': {
      const changeset = layout.nodes.get(target.id)?.changeset;
      if (!changeset) return null;
      return {
        title: `Changeset ${changeset.id} · ${changeset.branch}`,
        body: changeset.comment || 'No comment',
        meta: `${displayName(changeset.owner)} · ${formatRelativeDate(changeset.date)}`,
      };
    }
    case 'branch':
      return {
        title: target.lane.branch.name,
        body: target.lane.branch.comment || undefined,
        meta: `Created by ${displayName(target.lane.branch.owner)} · ${formatRelativeDate(target.lane.branch.date)}`,
      };
    case 'label':
      return {
        title: `Label ${target.label.name}`,
        body: target.label.comment || undefined,
        meta: `Changeset ${target.label.changeset} · ${displayName(target.label.owner)}`,
      };
    case 'mergeLink':
      return {
        title: MERGE_LINK_NAMES[target.link.type],
        meta: `From changeset ${target.link.sourceChangeset} to ${target.link.destinationChangeset}`,
      };
  }
}
