/**
 * How a window draws its title bar, per OS:
 * - `inset` (macOS): the page fills the window, the traffic lights inset over the sidebar's top band.
 * - `overlay` (Windows): the page fills the window, the caption buttons overlay the top bar's right end in the
 *   theme's colors, and a menu button in the sidebar's top band opens the menus (Alt and F10 too).
 * - `native` (Linux): the desktop's own frame and the menu bar above the page, as GNOME, KDE and tiling window
 *   managers each draw and place their buttons their own way.
 */
export type WindowChrome = 'inset' | 'overlay' | 'native';

export function windowChrome(platform: string): WindowChrome {
  if (platform === 'darwin') return 'inset';
  if (platform === 'win32') return 'overlay';
  return 'native';
}

/** The height of the top bar (`--topbar-height`), which the traffic lights and caption buttons share. */
export const TITLE_BAR_HEIGHT = 44;
