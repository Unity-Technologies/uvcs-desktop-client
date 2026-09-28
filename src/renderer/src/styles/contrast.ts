/** WCAG contrast of colors written as in tokens.css: `#rrggbb` or `rgba(r, g, b, a)` (composited over the background). */

type Rgb = [number, number, number];

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

/** The `--name: value;` declarations of each `[data-theme='…']` block of tokens.css (the light one also holds `:root`). */
export function themeTokens(css: string): Record<'light' | 'dark', Record<string, string>> {
  const block = (theme: string): Record<string, string> => {
    const start = css.indexOf(`[data-theme='${theme}'] {`);
    const body = css.slice(start, css.indexOf('}', start));
    return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1]!, match[2]!.trim()]));
  };
  return { light: block('light'), dark: block('dark') };
}
