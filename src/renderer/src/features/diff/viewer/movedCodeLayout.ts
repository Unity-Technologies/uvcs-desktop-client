/** Where something is down the diff's scrolled content, in pixels. */
export interface Span {
  top: number;
  bottom: number;
}

/** A box in the diff's scrolled content. */
export interface Box extends Span {
  left: number;
  right: number;
}

/** Where a move's label goes: its center's height, and the point it's centered on (`center`) or ends at (`end`). */
export interface LabelSpot {
  top: number;
  x: number;
  anchor: 'center' | 'end';
}

/** The room between a label and the right edge of its pane, when it sits on the moved code's bottom edge. */
const LABEL_INSET = 12;

/**
 * Where the label of one of a move's places goes. Best in the empty rows across from it, the hatched gap Pierre leaves
 * where the other side has no lines: centered there, it tells where the code went in the space that says it's gone.
 * A gap beside only part of the moved code would read as another change's, so it takes one across from half of it at
 * least. Otherwise (the moved code replaced other lines, or the diff is unified) the label sits at the right end of the
 * moved code's bottom edge, where code is least likely to be: the top edge is the change's own chip's (`ChangeChip`).
 */
export function labelSpot(place: Span, gapsAcross: Box[], ownPaneRight: number, rowHeight: number): LabelSpot {
  const needed = Math.max(rowHeight, (place.bottom - place.top) / 2);
  let best: Box | undefined;
  for (const gap of gapsAcross) {
    const overlap = { ...gap, top: Math.max(gap.top, place.top), bottom: Math.min(gap.bottom, place.bottom) };
    if (overlap.bottom - overlap.top >= needed && (!best || overlap.bottom - overlap.top > best.bottom - best.top)) best = overlap;
  }
  if (best) return { top: (best.top + best.bottom) / 2, x: (best.left + best.right) / 2, anchor: 'center' };
  return { top: place.bottom, x: ownPaneRight - LABEL_INSET, anchor: 'end' };
}

/** The box a ribbon between two places is drawn in, down the diff: from the higher top to the lower bottom. */
export function ribbonBox(from: Span, to: Span): Span {
  return { top: Math.min(from.top, to.top), bottom: Math.max(from.bottom, to.bottom) };
}

/**
 * The outline of a ribbon `width` wide joining a place on the left (`from`) to one on the right (`to`), in the
 * coordinates of its box (`ribbonBox`): each edge leaves its side level and curves to the other's, so the ribbon meets
 * the rows on both sides square and reads as one band however far apart they are.
 */
export function ribbonPath(from: Span, to: Span, width: number): string {
  const { top } = ribbonBox(from, to);
  const [a, b, c, d] = [from.top - top, to.top - top, to.bottom - top, from.bottom - top].map(round);
  const middle = round(width / 2);
  return `M0 ${a}C${middle} ${a} ${middle} ${b} ${width} ${b}L${width} ${c}C${middle} ${c} ${middle} ${d} 0 ${d}Z`;
}

const round = (value: number): number => Math.round(value * 10) / 10;
