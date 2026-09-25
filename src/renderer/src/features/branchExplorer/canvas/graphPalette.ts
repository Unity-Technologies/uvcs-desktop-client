import type { MergeLinkType } from '@shared/domain/branchExplorer';
import type { CodeReviewStatus } from '@shared/domain/codeReview';
import { branchHue, hueToColor, hueToInk } from '../model/branchHue';

/** The fonts the graph draws with, built once per theme so frames never assemble font strings. */
export interface GraphFonts {
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

/** Branch colors are asked for on every frame: each palette remembers the ones it computed. */
const branchColors = new WeakMap<GraphPalette, { lines: Map<string, string>; inks: Map<string, string> }>();

function colorsOf(palette: GraphPalette): { lines: Map<string, string>; inks: Map<string, string> } {
  let colors = branchColors.get(palette);
  if (!colors) branchColors.set(palette, (colors = { lines: new Map(), inks: new Map() }));
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

/** A branch's text color on its tinted header: the same hue with more contrast than the line. */
export function branchInk(palette: GraphPalette, branchName: string): string {
  const { inks } = colorsOf(palette);
  let color = inks.get(branchName);
  if (color === undefined) {
    const hue = branchHue(branchName);
    inks.set(branchName, (color = hue === null ? palette.accentText : hueToInk(hue, palette.isDark)));
  }
  return color;
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

const NO_DASH: number[] = [];
const DASHED = [6, 4];
const DOTTED = [2, 3];
