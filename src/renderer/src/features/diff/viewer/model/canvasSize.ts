// The 3D view's canvas size, and whether a new one is worth applying: sizing a canvas clears it, even to the size it
// has, so `ModelRenderer.setSize` sizes it only when its pixels change.

/** A canvas's size in whole CSS pixels (at least 1), and the screen's pixel ratio it is drawn at. */
export interface CanvasSize {
  width: number;
  height: number;
  pixelRatio: number;
}

export function canvasSizeOf(width: number, height: number, pixelRatio: number): CanvasSize {
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)), pixelRatio };
}

/** Whether `next` must be applied: always the first time (`current` null: the canvas has the browser's default size). */
export function canvasSizeChanged(current: CanvasSize | null, next: CanvasSize): boolean {
  return current === null || current.width !== next.width || current.height !== next.height || current.pixelRatio !== next.pixelRatio;
}
