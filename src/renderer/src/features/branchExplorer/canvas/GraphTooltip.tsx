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
  /** Near the right edge the tooltip opens to the left of the pointer, so it is never squeezed. */
  flip: boolean;
}

export function GraphTooltip({ target, layout, x, y, flip }: GraphTooltipProps) {
  const content = tooltipContent(target, layout);
  if (!content) return null;

  return (
    <div className={styles.tooltip} data-flip={flip} style={{ left: flip ? x - 14 : x + 14, top: y + 14 }}>
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
    case 'collapsed': {
      const run = target.node.collapsed!;
      return {
        title: `${run.length} changesets on ${target.node.changeset.branch}`,
        body: `Changesets ${run[0]!.id} to ${run.at(-1)!.id}, hidden by “Only relevant changesets”.`,
        meta: 'Click to show them',
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
    case 'codeReview':
      return {
        title: target.review.title,
        body: `Code review ${target.review.id} · ${target.review.status}`,
        meta: 'Click to open the review',
      };
    case 'mergeLink':
      return {
        title: MERGE_LINK_NAMES[target.link.type],
        meta: `From changeset ${target.link.sourceChangeset} to ${target.link.destinationChangeset}`,
      };
  }
}
