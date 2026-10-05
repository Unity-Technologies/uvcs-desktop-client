import { avatarColorOf, AVATAR_COLORS, type AvatarColor } from '../../../../lib/avatarColors';

/** The 3D view's colors, read from `styles/tokens.css` for the app's theme (WebGL can't take a `var()`). */
export interface ModelPalette {
  isDark: boolean;
  backdrop: string;
  clay: string;
  wire: string;
  grid: string;
  gridMajor: string;
  highlight: string;
  /** What is gone in the Differences mode: the version before's ghost. */
  removed: string;
  axisX: string;
  axisY: string;
  axisZ: string;
  /** Material slots by name: the avatar fills, so a slot keeps its color in both versions and a renamed one changes. */
  slots: Record<AvatarColor, string>;
}

export function readModelPalette(element: Element): ModelPalette {
  const style = getComputedStyle(element);
  const variable = (name: string): string => style.getPropertyValue(name).trim();
  return {
    isDark: document.documentElement.dataset.theme === 'dark',
    backdrop: variable('--bg-subtle'),
    clay: variable('--model-clay'),
    wire: variable('--text-secondary'),
    grid: variable('--border-default'),
    gridMajor: variable('--border-strong'),
    highlight: variable('--accent'),
    removed: variable('--status-deleted'),
    axisX: variable('--model-axis-x'),
    axisY: variable('--model-axis-y'),
    axisZ: variable('--model-axis-z'),
    slots: Object.fromEntries(AVATAR_COLORS.map((name) => [name, variable(name)])) as Record<AvatarColor, string>,
  };
}

/** The color of a material slot, by its name. */
export function slotColor(palette: ModelPalette, slot: string): string {
  return palette.slots[avatarColorOf(slot)];
}
