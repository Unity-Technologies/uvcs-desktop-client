/** WCAG contrast of colors written as in tokens.css: `#rrggbb` or `rgba(r, g, b, a)` (composited over the background). */

export type Rgb = [number, number, number];

export interface Rgba {
  rgb: Rgb;
  alpha: number;
}

export function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/.exec(value.trim());
  if (rgba) return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: rgba[4] === undefined ? 1 : Number(rgba[4]) };
  throw new Error(`Not a color: ${value}`);
}

/** `hsl(hue saturation% lightness% / alpha)`, as the marks colored per name are written (percentages as tokens.css holds them). */
export function hslColor(hue: number, saturation: string, lightness: string, alpha = 1): Rgba {
  const s = Number.parseFloat(saturation) / 100;
  const l = Number.parseFloat(lightness) / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12;
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return { rgb: [channel(0), channel(8), channel(4)], alpha };
}

/** A translucent color as it shows over an opaque one. */
export function composite(top: Rgba, bottom: Rgb): Rgb {
  return top.rgb.map((channel, index) => channel * top.alpha + bottom[index]! * (1 - top.alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** The hue of an opaque color, in degrees (0 for grays). */
export function hueOf([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const sector = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (sector * 60 + 360) % 360;
}

/**
 * Text of a hue and saturation that reads at `ratio` on `background` and no more: as light as it can be on a light
 * background, as dark as it can be on a dark one, so text of every hue weighs alike (black or white when the ratio
 * can't be reached). Luminance grows with lightness at any hue and saturation, so halving the range finds it.
 */
export function hslAtContrast(hue: number, saturation: string, ratio: number, background: Rgb): Rgb {
  const onLight = contrastRatio([0, 0, 0], background) >= contrastRatio([255, 255, 255], background);
  const at = (lightness: number): Rgb => hslColor(hue, saturation, `${lightness}%`).rgb;
  // `reaching` always reads at the ratio (or is black or white); `missing` never does.
  let reaching = onLight ? 0 : 100;
  let missing = onLight ? 100 : 0;
  for (let step = 0; step < 16; step++) {
    const middle = (reaching + missing) / 2;
    if (contrastRatio(at(middle), background) >= ratio) reaching = middle;
    else missing = middle;
  }
  return at(reaching);
}

/** The `--name: value;` declarations of each `[data-theme='…']` block of tokens.css (the light one also holds `:root`). */
export function themeTokens(css: string): Record<'light' | 'dark', Record<string, string>> {
  const block = (theme: string): Record<string, string> => {
    const start = css.indexOf(`[data-theme='${theme}'] {`);
    const body = css.slice(start, css.indexOf('}', start));
    return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]));
  };
  return { light: block('light'), dark: block('dark') };
}
