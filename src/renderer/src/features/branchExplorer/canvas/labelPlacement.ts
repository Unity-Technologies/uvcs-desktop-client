import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import { BAND_HEIGHT, HEADER_SPAN_COLUMNS, headerTop, rowY } from './geometry';

/** Labels are drawn as chips stacked above their changeset. */
export const LABEL_HEIGHT = 16;
const LABEL_GAP = 4;
const LABEL_PADDING = 7;
/** Average glyph width of the label font, to size pills where no canvas is at hand (hit testing). */
const AVERAGE_GLYPH_WIDTH = 6;

/**
 * Top of the `index`-th label of a changeset. Labels sit just above the band, except on the first
 * columns of a branch, where the branch header card is: there they stack above the card.
 */
export function labelTop(layout: GraphLayout, node: NodeLayout, index: number): number {
  const y = rowY(node.row);
  const lane = layout.lanesByBranch.get(node.changeset.branch);
  const underHeader = lane?.firstOwnColumn != null && node.column - lane.firstOwnColumn < HEADER_SPAN_COLUMNS;
  const bottom = underHeader ? headerTop(y) - LABEL_GAP : y - BAND_HEIGHT / 2 - LABEL_GAP;
  return bottom - (index + 1) * LABEL_HEIGHT - index * LABEL_GAP;
}

export function labelWidth(textWidth: number): number {
  return textWidth + LABEL_PADDING * 2;
}

export function estimatedLabelWidth(name: string): number {
  return labelWidth(name.length * AVERAGE_GLYPH_WIDTH);
}
