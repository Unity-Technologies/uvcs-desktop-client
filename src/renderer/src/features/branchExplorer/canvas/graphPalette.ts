import type { MergeLinkType } from '@shared/domain/branchExplorer';
import { branchHue, hueToColor } from '../model/branchHue';

/** Colors and fonts for drawing, resolved from the app's CSS variables so the graph follows the theme. */
export interface GraphPalette {
  isDark: boolean;
  background: string;
  surface: string;
  textTertiary: string;
  gridLine: string;
  accent: string;
  searchHit: string;
  labelBackground: string;
  labelText: string;
  mergeLinks: Record<MergeLinkType, string>;
  fontUi: string;
}

export function readGraphPalette(element: Element): GraphPalette {
  const style = getComputedStyle(element);
  const variable = (name: string): string => style.getPropertyValue(name).trim();

  return {
    isDark: document.documentElement.dataset.theme === 'dark',
    background: variable('--bg-surface'),
    surface: variable('--bg-surface'),
    textTertiary: variable('--text-tertiary'),
    gridLine: variable('--border-subtle'),
    accent: variable('--accent'),
    searchHit: variable('--search-highlight'),
    labelBackground: variable('--label-bg'),
    labelText: variable('--label-text'),
    mergeLinks: {
      merge: variable('--status-added'),
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
