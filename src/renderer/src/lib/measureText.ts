let canvasContext: CanvasRenderingContext2D | null = null;

/** Measures text the way `element` renders it, optionally in another weight (a dimmed part set in regular type). */
export function textMeasurer(element: HTMLElement, fontWeight?: string): (text: string) => number {
  canvasContext ??= document.createElement('canvas').getContext('2d');
  const context = canvasContext;
  if (!context) return (text) => text.length * 8;
  const style = getComputedStyle(element);
  const font = `${style.fontStyle} ${fontWeight ?? style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
  // The context is shared, so every measurement sets the font it needs.
  return (text) => {
    context.font = font;
    context.letterSpacing = letterSpacing;
    return context.measureText(text).width;
  };
}
