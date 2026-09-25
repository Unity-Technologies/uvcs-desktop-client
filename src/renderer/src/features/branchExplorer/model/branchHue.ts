/**
 * Calm, clearly distinct hues for branches: greens, oranges, teals, roses and ambers first,
 * so the accent-colored `/main` stays the only strong blue and nothing leans purple.
 */
const BRANCH_HUES = [152, 24, 188, 344, 42, 118, 8, 60, 316, 170];

/** A stable hue per branch name, so a branch keeps its color everywhere. `/main` uses the accent color instead (null). */
export function branchHue(branchName: string): number | null {
  if (branchName === '/main') return null;
  let hash = 0;
  for (const char of branchName) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return BRANCH_HUES[Math.abs(hash) % BRANCH_HUES.length]!;
}

/** Lightness and saturation tuned for each theme's background. */
export function hueToColor(hue: number, isDark: boolean): string {
  return isDark ? `hsl(${hue} 58% 62%)` : `hsl(${hue} 60% 42%)`;
}

/** Text in a branch's hue, readable on the branch's own light tint. */
export function hueToInk(hue: number, isDark: boolean): string {
  return isDark ? `hsl(${hue} 75% 74%)` : `hsl(${hue} 70% 30%)`;
}
