/**
 * How a release note's before-and-after picture is laid out (`scripts/beforeAfter.mjs`, the `release-notes` skill):
 * the two shots, each under its label, in one picture, side by side or one above the other, whichever keeps the
 * picture closest to the shape What's New shows best.
 */

export interface ShotSize {
  width: number;
  height: number;
}

export interface BeforeAfterPanel {
  label: 'Before' | 'After';
  /** Where the shot itself goes, under its label. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BeforeAfterLayout {
  direction: 'row' | 'column';
  width: number;
  height: number;
  labelHeight: number;
  panels: BeforeAfterPanel[];
}

/** Around the picture, between the two shots, and the label's row above each, at one pixel per point. */
export const BEFORE_AFTER_SPACING = { padding: 16, gap: 16, labelHeight: 28 } as const;

/**
 * What's New shows a picture as wide as the text, about 600 pixels, and no taller than 360 (`InlinePicture`): a
 * picture of that shape shows the largest.
 */
const NOTE_PICTURE_ASPECT = 600 / 360;

/** The layout for two shots of `shot`'s size, taken at `pixelRatio` pixels per point (2 on a high-density screen). */
export function beforeAfterLayout(shot: ShotSize, pixelRatio = 1): BeforeAfterLayout {
  const padding = BEFORE_AFTER_SPACING.padding * pixelRatio;
  const gap = BEFORE_AFTER_SPACING.gap * pixelRatio;
  const labelHeight = BEFORE_AFTER_SPACING.labelHeight * pixelRatio;
  const panelHeight = labelHeight + shot.height;
  const row = { width: padding * 2 + shot.width * 2 + gap, height: padding * 2 + panelHeight };
  const column = { width: padding * 2 + shot.width, height: padding * 2 + panelHeight * 2 + gap };
  const direction = aspectDistance(row) <= aspectDistance(column) ? 'row' : 'column';
  const second = direction === 'row' ? { x: padding + shot.width + gap, y: padding + labelHeight } : { x: padding, y: padding + panelHeight + gap + labelHeight };
  return {
    direction,
    ...(direction === 'row' ? row : column),
    labelHeight,
    panels: [
      { label: 'Before', x: padding, y: padding + labelHeight, width: shot.width, height: shot.height },
      { label: 'After', ...second, width: shot.width, height: shot.height },
    ],
  };
}

/** How far a picture's shape is from the note's, in ratio: twice as wide counts as much as twice as narrow. */
function aspectDistance({ width, height }: ShotSize): number {
  return Math.abs(Math.log(width / height / NOTE_PICTURE_ASPECT));
}

/**
 * Why two shots can't make a before and after, or null when they can. They must be the same size: the same crop of the
 * same place, at the same window size, so the change is the only thing that differs.
 */
export function beforeAfterSizeError(before: ShotSize, after: ShotSize): string | null {
  if (before.width === after.width && before.height === after.height) return null;
  return `The before shot is ${before.width}×${before.height} and the after shot ${after.width}×${after.height}: crop both from the same area, at the same window size.`;
}
