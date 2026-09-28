/** Hues that read well in both themes; purples are left out so avatars and marks never compete with the accent. */
export const STABLE_HUES = [205, 190, 170, 150, 125, 45, 30, 15, 355, 335];

/** A stable place among the `STABLE_HUES` per name, for palettes laid out in their order. */
export function stableHueIndex(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % STABLE_HUES.length;
}

/** A stable hue per name, so the same person or repository always gets the same color. */
export function stableHue(name: string): number {
  return STABLE_HUES[stableHueIndex(name)]!;
}
