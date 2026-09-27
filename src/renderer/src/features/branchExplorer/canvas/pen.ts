/** The canvas calls that place shapes and text. The context itself is one, drawing where its transform says. */
export interface Pen {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  roundRect(x: number, y: number, width: number, height: number, radius: number): void;
  fillText(text: string, x: number, y: number): void;
  drawImage(image: CanvasImageSource, x: number, y: number, width: number, height: number): void;
}

/** Origins move in steps this long (world px): what the canvas gets stays within a few of them, and panning rarely moves it. */
const ORIGIN_STEP = 16384;

/**
 * The frame's origin along an axis, at or before the start of the visible area. Zero within the first step, whatever
 * is scrolled past the graph's edge: small graphs draw exactly as without an origin.
 */
export function originFor(visibleStart: number): number {
  return Math.floor(Math.max(0, visibleStart) / ORIGIN_STEP) * ORIGIN_STEP;
}

/**
 * A pen taking world positions that hands the canvas positions relative to the frame's origin, the world transform
 * carrying the origin instead. The canvas keeps its points in float32: at the millions of world px a whole history
 * reaches, they land up to a pixel apart, and zoomed in on a Retina display circles and rounded corners come out
 * jagged. Relative to an origin near the screen, every position stays small; the subtraction happens in doubles.
 */
export class OriginPen implements Pen {
  private ctx: CanvasRenderingContext2D | null = null;
  private x = 0;
  private y = 0;

  /** Points the pen at a frame: its context, and the world position that is (0, 0) for the canvas. */
  aim(ctx: CanvasRenderingContext2D, originX: number, originY: number): void {
    this.ctx = ctx;
    this.x = originX;
    this.y = originY;
  }

  moveTo(x: number, y: number): void {
    this.ctx!.moveTo(x - this.x, y - this.y);
  }

  lineTo(x: number, y: number): void {
    this.ctx!.lineTo(x - this.x, y - this.y);
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    this.ctx!.arcTo(x1 - this.x, y1 - this.y, x2 - this.x, y2 - this.y, radius);
  }

  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    this.ctx!.bezierCurveTo(c1x - this.x, c1y - this.y, c2x - this.x, c2y - this.y, x - this.x, y - this.y);
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void {
    this.ctx!.arc(x - this.x, y - this.y, radius, startAngle, endAngle);
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.ctx!.rect(x - this.x, y - this.y, width, height);
  }

  roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.ctx!.roundRect(x - this.x, y - this.y, width, height, radius);
  }

  fillText(text: string, x: number, y: number): void {
    this.ctx!.fillText(text, x - this.x, y - this.y);
  }

  drawImage(image: CanvasImageSource, x: number, y: number, width: number, height: number): void {
    this.ctx!.drawImage(image, x - this.x, y - this.y, width, height);
  }
}
