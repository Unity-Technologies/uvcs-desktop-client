import type { MergeLinkType } from '@shared/domain/branchExplorer';
import { branchHue, hueToColor } from '../model/branchHue';

/** Colors and fonts for drawing, resolved from the app's CSS variables so the graph follows the theme and accent. */
export interface GraphPalette {
  isDark: boolean;
  background: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  gridLine: string;
  accent: string;
  accentContrast: string;
  current: string;
  searchHit: string;
  labelBackground: string;
  labelText: string;
  /** Link colors for everything but plain merges, which take the source branch's color. */
  mergeLinks: Record<Exclude<MergeLinkType, 'merge'>, string>;
  fontUi: string;
}

export function readGraphPalette(element: Element): GraphPalette {
  const style = getComputedStyle(element);
  const variable = (name: string): string => style.getPropertyValue(name).trim();

  return {
    isDark: document.documentElement.dataset.theme === 'dark',
    background: variable('--bg-surface'),
    surfaceRaised: variable('--bg-surface-raised'),
    border: variable('--border-default'),
    textPrimary: variable('--text-primary'),
    textSecondary: variable('--text-secondary'),
    textTertiary: variable('--text-tertiary'),
    gridLine: variable('--border-subtle'),
    accent: variable('--accent'),
    accentContrast: variable('--accent-contrast'),
    current: variable('--status-added'),
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
    fontUi: variable('--font-ui'),
  };
}

export function branchColor(palette: GraphPalette, branchName: string): string {
  const hue = branchHue(branchName);
  return hue === null ? palette.accent : hueToColor(hue, palette.isDark);
}

/** Dashes distinguish cherry picks and subtractive merges; intervals are dotted. */
export function mergeLinkDash(type: MergeLinkType): number[] {
  switch (type) {
    case 'merge':
      return [];
    case 'cherryPick':
    case 'subtractive':
      return [6, 4];
    case 'interval':
    case 'intervalCherryPick':
    case 'intervalSubtractive':
      return [2, 3];
  }
}
