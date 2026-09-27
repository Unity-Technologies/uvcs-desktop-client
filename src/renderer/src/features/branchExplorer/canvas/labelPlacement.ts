import type { GraphLabel } from '@shared/domain/branchExplorer';
import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import { BAND_HEIGHT, HEADER_SPAN_COLUMNS, ROW_HEIGHT, rowY } from './geometry';
import { laneHeaderTop } from './laneShape';

/** Labels are drawn as chips stacked above their changeset. */
export const LABEL_HEIGHT = 16;
const LABEL_GAP = 4;
const LABEL_PADDING = 7;
/** Average glyph width of the label font, to size pills where no canvas is at hand (hit testing). */
const AVERAGE_GLYPH_WIDTH = 6;
/** Room kept below the band of the row above for its changesets' comments, which chips must not cover. */
const CAPTION_ROOM = 24;

/** A chip above a changeset: one label, or the last one that fits standing for the rest too ("v2 +3"). */
export interface LabelChip {
  label: GraphLabel;
  /** The labels that didn't fit, counted on this chip. */
  more: readonly GraphLabel[];
  text: string;
  top: number;
}

/**
 * The chips of a changeset's labels. They sit just above the band, except on the first columns of a branch, where
 * the branch header card is: there they stack above the card. They stack only as high as the comments of the row
 * above: past that, the last chip that fits counts the rest.
 */
export function labelChips(layout: GraphLayout, node: NodeLayout): LabelChip[] {
  const labels = layout.labelsByChangeset.get(node.changeset.id) ?? [];
  const y = rowY(node.row);
  const lane = layout.lanesByBranch.get(node.changeset.branch);
  const underHeader = lane?.firstOwnColumn != null && node.column - lane.firstOwnColumn < HEADER_SPAN_COLUMNS;
  const bottom = underHeader ? laneHeaderTop(lane) - LABEL_GAP : y - BAND_HEIGHT / 2 - LABEL_GAP;
  const ceiling = y - ROW_HEIGHT + BAND_HEIGHT / 2 + CAPTION_ROOM;
  const fitting = Math.max(1, Math.floor((bottom - ceiling + LABEL_GAP) / (LABEL_HEIGHT + LABEL_GAP)));
  const shown = Math.min(fitting, labels.length);

  return labels.slice(0, shown).map((label, index) => {
    const more = index === shown - 1 ? labels.slice(shown) : [];
    return {
      label,
      more,
      text: more.length > 0 ? `${label.name} +${more.length}` : label.name,
      top: bottom - (index + 1) * LABEL_HEIGHT - index * LABEL_GAP,
    };
  });
}

export function labelWidth(textWidth: number): number {
  return textWidth + LABEL_PADDING * 2;
}

export function estimatedLabelWidth(text: string): number {
  return labelWidth(text.length * AVERAGE_GLYPH_WIDTH);
}
