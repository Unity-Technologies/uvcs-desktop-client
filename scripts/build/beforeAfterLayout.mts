/**
 * How a release note's before-and-after picture is laid out (`scripts/beforeAfter.mjs`, the `release-notes` skill):
 * the two shots, each under its label, in one picture, side by side or one above the other, whichever keeps the
 * picture closest to the shape What's New shows best; and what the script is asked. Not the build's, but here, where
 * the tests and the type check of the scripts' logic look. `.mts`: the script imports it as a module.
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

/** A box of a shot, in its pixels: what both shots are cropped to, so they show the same place. */
export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Why `box` can't crop a shot of `shot`'s size, or null when it can. */
export function cropBoxError(box: CropBox, shot: ShotSize): string | null {
  if (box.x + box.width <= shot.width && box.y + box.height <= shot.height) return null;
  return `The crop ${box.x},${box.y},${box.width},${box.height} reaches past the ${shot.width}×${shot.height} shot.`;
}

export interface BeforeAfterArguments {
  before: string;
  after: string;
  output: string;
  pixelRatio: number;
  /** One box for both shots, taken whole (the window); null when they're cropped already. */
  crop: CropBox | null;
  /** Framed in the dark theme's page, for shots of the dark theme. */
  dark: boolean;
}

export const BEFORE_AFTER_USAGE =
  'Usage: npx electron scripts/beforeAfter.mjs [--scale=2] [--crop=x,y,width,height] [--dark] <before.png> <after.png> <output.png>';

/** What the script is asked (its arguments after its own path), or its usage when they make no sense. */
export function beforeAfterArguments(args: readonly string[]): BeforeAfterArguments | string {
  const files = args.filter((argument) => !argument.startsWith('--'));
  let pixelRatio = 1;
  let crop: CropBox | null = null;
  let dark = false;
  for (const option of args.filter((argument) => argument.startsWith('--'))) {
    if (option === '--dark') dark = true;
    else if (option.startsWith('--scale=')) pixelRatio = Number(option.slice('--scale='.length));
    else if (option.startsWith('--crop=')) crop = cropBoxOf(option.slice('--crop='.length));
    else return BEFORE_AFTER_USAGE;
  }
  const scaleIsValid = Number.isFinite(pixelRatio) && pixelRatio > 0;
  const cropIsValid = !args.some((argument) => argument.startsWith('--crop=')) || crop !== null;
  if (files.length !== 3 || !scaleIsValid || !cropIsValid) return BEFORE_AFTER_USAGE;
  const [before, after, output] = files;
  return { before, after, output, pixelRatio, crop, dark };
}

/** `x,y,width,height` in whole pixels, a box with room in it; null otherwise. */
function cropBoxOf(text: string): CropBox | null {
  const numbers = text.split(',').map(Number);
  if (numbers.length !== 4 || numbers.some((value) => !Number.isInteger(value) || value < 0)) return null;
  const [x, y, width, height] = numbers;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}
