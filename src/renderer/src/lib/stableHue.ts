/** Hues that read well in both themes; purples are left out so avatars and marks never compete with the accent. */
export const STABLE_HUES = [205, 190, 170, 150, 125, 45, 30, 15, 355, 335];

/** A stable hue per name, so the same person or repository always gets the same color. */
export function stableHue(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return STABLE_HUES[Math.abs(hash) % STABLE_HUES.length]!;
}
