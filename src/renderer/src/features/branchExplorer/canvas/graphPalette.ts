import type { MergeLinkType } from '@shared/domain/branchExplorer';
import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { composite, hslAtContrast, hslColor, hueOf, parseColor, type Rgb } from '../../../styles/contrast';
import { branchHue, hueToColor, hueToInk, LINE_TONE } from '../model/branchHue';

/** The fonts the graph draws with, built once per theme so frames never assemble font strings. */
interface GraphFonts {
  branchName: string;
  branchComment: string;
  compactBranchName: string;
  badge: string;
  label: string;
  initials: string;
  collapsed: string;
  /** Changeset comments, drawn at a fixed screen size. */
  caption: string;
  ruler: string;
}

/** Text in a hue at this saturation, as light (or, in the dark theme, as dark) as reads at this contrast. */
interface TextTone {
  saturation: string;
  contrast: number;
}

/** A branch header's name, and its comment under it, quieter: less saturated and at less contrast. */
export interface HeaderText {
  name: TextTone;
  comment: TextTone;
}

/** Colors and fonts for drawing, resolved from the app's CSS variables so the graph follows the theme and accent. */
export interface GraphPalette {
  isDark: boolean;
  background: string;
  surfaceRaised: string;
  /** The sticky date ruler. */
  panel: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  gridLine: string;
  accent: string;
  accentText: string;
  /** How a branch header writes its name and comment in its branch's hue. */
  headerText: HeaderText;
  accentContrast: string;
  /** The soft halo behind a selection. */
  accentSoft: string;
  /** Search hits glow in this color, whatever the branch color. */
  searchHit: string;
  labelBackground: string;
  labelText: string;
  /** Link colors for everything but plain merges, which take the source branch's color. */
  mergeLinks: Record<Exclude<MergeLinkType, 'merge'>, string>;
  /** Code review chips, colored like the status badges elsewhere. */
  reviewStatus: Record<CodeReviewStatus, string>;
  fontUi: string;
  fonts: GraphFonts;
  /** Screen size of the changeset comments, shared with the tooltip that completes them in place. */
  captionFontSize: number;
}

/** Changeset comments: a fixed on-screen size at every zoom, like map labels. */
const CAPTION_FONT_SIZE = 12;
const CAPTION_FONT_WEIGHT = 500;

export function readGraphPalette(element: Element): GraphPalette {
  const style = getComputedStyle(element);
  const variable = (name: string): string => style.getPropertyValue(name).trim();
  const fontUi = variable('--font-ui');

  return {
    isDark: document.documentElement.dataset.theme === 'dark',
    background: variable('--bg-surface'),
    surfaceRaised: variable('--bg-surface-raised'),
    panel: variable('--bg-subtle'),
    border: variable('--border-default'),
    textPrimary: variable('--text-primary'),
    textSecondary: variable('--text-secondary'),
    textTertiary: variable('--text-tertiary'),
    gridLine: variable('--border-subtle'),
    accent: variable('--accent'),
    accentText: variable('--accent-text'),
    headerText: {
      name: { saturation: variable('--branch-name-saturation'), contrast: Number(variable('--branch-name-contrast')) },
      comment: { saturation: variable('--branch-comment-saturation'), contrast: Number(variable('--branch-comment-contrast')) },
    },
    accentContrast: variable('--accent-contrast'),
    accentSoft: variable('--accent-soft'),
    searchHit: variable('--search-highlight'),
    labelBackground: variable('--label-bg'),
    labelText: variable('--label-text'),
    mergeLinks: {
      interval: variable('--status-added'),
      cherryPick: variable('--status-changed'),
      intervalCherryPick: variable('--status-changed'),
      subtractive: variable('--status-deleted'),
      intervalSubtractive: variable('--status-deleted'),
    },
    reviewStatus: {
      'Under review': variable('--status-moved'),
      Reviewed: variable('--status-added'),
      'Rework required': variable('--status-changed'),
    },
    fontUi,
    fonts: {
      branchName: `600 11.5px ${fontUi}`,
      branchComment: `400 10.5px ${fontUi}`,
      compactBranchName: `600 10.5px ${fontUi}`,
      badge: `600 9.5px ${fontUi}`,
      label: `600 10px ${fontUi}`,
      initials: `600 9.5px ${fontUi}`,
      collapsed: `600 10px ${fontUi}`,
      caption: `${CAPTION_FONT_WEIGHT} ${CAPTION_FONT_SIZE}px ${fontUi}`,
      ruler: `400 11px ${fontUi}`,
    },
    captionFontSize: CAPTION_FONT_SIZE,
  };
}

/** How strongly a branch header takes its branch's color over the raised surface, and how much more while hovered. */
export const HEADER_TINT = { light: 0.15, dark: 0.18 };
export const HEADER_HOVER_TINT = 0.06;

/** A branch header's text colors, as the canvas takes them. */
export interface HeaderInks {
  name: string;
  comment: string;
}

interface BranchColors {
  lines: Map<string, string>;
  inks: Map<string, string>;
  /** By the hue of the header's fill, null for the accent's. */
  headers: Map<number | null, HeaderInks>;
}

/** Branch colors are asked for on every frame: each palette remembers the ones it computed. */
const branchColors = new WeakMap<GraphPalette, BranchColors>();

function colorsOf(palette: GraphPalette): BranchColors {
  let colors = branchColors.get(palette);
  if (!colors) branchColors.set(palette, (colors = { lines: new Map(), inks: new Map(), headers: new Map() }));
  return colors;
}

/** A branch's line and ring color. */
export function branchColor(palette: GraphPalette, branchName: string): string {
  const { lines } = colorsOf(palette);
  let color = lines.get(branchName);
  if (color === undefined) {
    const hue = branchHue(branchName);
    lines.set(branchName, (color = hue === null ? palette.accent : hueToColor(hue, palette.isDark)));
  }
  return color;
}

/** A branch's name over the graph's background, zoomed out: the same hue with more contrast than the line. */
export function branchInk(palette: GraphPalette, branchName: string): string {
  const { inks } = colorsOf(palette);
  let color = inks.get(branchName);
  if (color === undefined) {
    const hue = branchHue(branchName);
    inks.set(branchName, (color = hue === null ? palette.accentText : hueToInk(hue, palette.isDark)));
  }
  return color;
}

/**
 * The name and comment colors on a branch's header, tinted in its line color (the accent's on the current branch and
 * `/main`): its hue, the comment quieter than the name, as secondary text is to primary text.
 */
export function headerInks(palette: GraphPalette, branchName: string, current: boolean): HeaderInks {
  const { headers } = colorsOf(palette);
  const hue = current ? null : branchHue(branchName);
  let inks = headers.get(hue);
  if (inks === undefined) {
    const theme = palette.isDark ? 'dark' : 'light';
    const line = LINE_TONE[theme];
    const fill = hue === null ? parseColor(palette.accent).rgb : hslColor(hue, line.saturation, line.lightness).rgb;
    const text = headerTextOn(fill, parseColor(palette.surfaceRaised).rgb, theme, palette.headerText);
    headers.set(hue, (inks = { name: rgb(text.name), comment: rgb(text.comment) }));
  }
  return inks;
}

/**
 * A header's text in its fill's hue, at the contrast `text` asks on the hovered tint, the strongest: the plain one only
 * reads better, and every hue weighs alike, however light or dark its line is (yellows are much lighter than blues).
 */
export function headerTextOn(fill: Rgb, surface: Rgb, theme: 'light' | 'dark', text: HeaderText): { name: Rgb; comment: Rgb } {
  const tint = composite({ rgb: fill, alpha: HEADER_TINT[theme] + HEADER_HOVER_TINT }, surface);
  const hue = hueOf(fill);
  return {
    name: hslAtContrast(hue, text.name.saturation, text.name.contrast, tint),
    comment: hslAtContrast(hue, text.comment.saturation, text.comment.contrast, tint),
  };
}

function rgb([r, g, b]: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Dashes distinguish cherry picks and subtractive merges; intervals are dotted. */
export function mergeLinkDash(type: MergeLinkType): number[] {
  switch (type) {
    case 'merge':
      return NO_DASH;
    case 'cherryPick':
    case 'subtractive':
      return DASHED;
    case 'interval':
    case 'intervalCherryPick':
    case 'intervalSubtractive':
      return DOTTED;
  }
}

/** A merge in progress, not checked in yet: dots (with round caps), whatever kind of merge it is. */
export const PENDING_LINK_DASH = [0, 5];

const NO_DASH: number[] = [];
const DASHED = [6, 4];
const DOTTED = [2, 3];
