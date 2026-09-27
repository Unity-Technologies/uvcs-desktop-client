let canvasContext: CanvasRenderingContext2D | null = null;
/** The font the shared context is set to: setting it parses the font again, even when it's the same. */
let contextFont = '';

/**
 * Widths already measured, per font: fitting a path (`fitPath`) measures the same folders and names again on every
 * resize of every row. The fonts are the system's, never loading late, so a width once measured stays true. Forgotten
 * all at once past a bound, so a long session never grows it.
 */
const widths = new Map<string, number>();
const MAX_WIDTHS = 20_000;

/** Measures text the way `element` renders it, optionally in another weight (a dimmed part set in regular type). */
export function textMeasurer(element: HTMLElement, fontWeight?: string): (text: string) => number {
  canvasContext ??= document.createElement('canvas').getContext('2d');
  const context = canvasContext;
  if (!context) return (text) => text.length * 8;
  const style = getComputedStyle(element);
  const letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
  const font = `${style.fontStyle} ${fontWeight ?? style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const fontKey = `${font}|${letterSpacing}|`;
  return (text) => {
    const key = fontKey + text;
    const known = widths.get(key);
    if (known !== undefined) return known;
    // The context is shared, so every measurement sets the font it needs.
    if (contextFont !== fontKey) {
      context.font = font;
      context.letterSpacing = letterSpacing;
      contextFont = fontKey;
    }
    const width = context.measureText(text).width;
    if (widths.size >= MAX_WIDTHS) widths.clear();
    widths.set(key, width);
    return width;
  };
}
