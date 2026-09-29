/**
 * Calm, clearly distinct hues for branches: greens, oranges, teals, roses and ambers first,
 * so the accent-colored `/main` stays the only strong blue and nothing leans purple.
 */
export const BRANCH_HUES = [152, 24, 188, 344, 42, 118, 8, 60, 316, 170];

/** A stable hue per branch name, so a branch keeps its color everywhere. `/main` uses the accent color instead (null). */
export function branchHue(branchName: string): number | null {
  if (branchName === '/main') return null;
  let hash = 0;
  for (const char of branchName) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return BRANCH_HUES[Math.abs(hash) % BRANCH_HUES.length]!;
}

/** Saturation and lightness of branch lines, tuned for each theme's background. */
export const LINE_TONE = { light: { saturation: '60%', lightness: '42%' }, dark: { saturation: '58%', lightness: '62%' } };

export function hueToColor(hue: number, isDark: boolean): string {
  const { saturation, lightness } = LINE_TONE[isDark ? 'dark' : 'light'];
  return `hsl(${hue} ${saturation} ${lightness})`;
}

/** Text in a branch's hue over the graph's background: its name, zoomed out. */
export function hueToInk(hue: number, isDark: boolean): string {
  return isDark ? `hsl(${hue} 75% 74%)` : `hsl(${hue} 70% 30%)`;
}
