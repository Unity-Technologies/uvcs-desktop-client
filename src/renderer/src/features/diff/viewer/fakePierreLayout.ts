/** A row's height as estimated before it renders, and a line's that doesn't wrap. */
export const FAKE_ROW_HEIGHT = 20;

/**
 * For tests: a diff laid out as Pierre's `Virtualizer` lays one out, rendering only the rows in view and a view's worth
 * around them. A line's height is estimated as one row until it renders, then measured (a wrapped line, two rows), which
 * moves the lines below it. Pierre renders the rows a scroll brings in a frame later (`endFrame` renders around where
 * the view stood as the frame began), so what's placed by a scroll moves on the frames after it, as on screen.
 */
export class FakePierreLayout {
  scrollTop = 0;
  readonly viewHeight: number;
  private readonly lines: number;
  private readonly wrapped: Set<number>;
  private readonly measured = new Set<number>();
  private rendered = { first: 0, last: -1 };
  private frameStart = 0;

  constructor({ lines, wrapped, viewHeight }: { lines: number; wrapped: number[]; viewHeight: number }) {
    this.lines = lines;
    this.wrapped = new Set(wrapped);
    this.viewHeight = viewHeight;
    this.render(0);
  }

  /** Where Pierre lays a line out, from the top of the diff: the heights it measured above it, one row for the others. */
  lineTop(line: number): number {
    let top = 0;
    for (let above = 1; above < line; above++) top += this.lineHeight(above);
    return top;
  }

  /** A line's height as laid out: one row until it renders. */
  lineHeight(line: number): number {
    return this.measured.has(line) && this.wrapped.has(line) ? 2 * FAKE_ROW_HEIGHT : FAKE_ROW_HEIGHT;
  }

  /** Where a line's row stands below the top of the view; null while it isn't rendered. */
  rowOffset(line: number): number | null {
    return line >= this.rendered.first && line <= this.rendered.last ? this.lineTop(line) - this.scrollTop : null;
  }

  maxScroll(): number {
    return Math.max(0, this.lineTop(this.lines + 1) - this.viewHeight);
  }

  /** Scrolls as an element does: within the ends of the content. */
  scrollTo(top: number): void {
    this.scrollTop = Math.min(Math.max(0, top), this.maxScroll());
  }

  /** A frame begins: Pierre will render around where the view stands now. */
  startFrame(): void {
    this.frameStart = this.scrollTop;
  }

  /** A frame ends: Pierre renders the rows around where the view stood as it began, measuring them. */
  endFrame(): void {
    this.render(this.frameStart);
    this.scrollTo(this.scrollTop);
  }

  private render(at: number): void {
    let first = 0;
    let last = 0;
    for (let line = 1, top = 0; line <= this.lines; top += this.lineHeight(line), line++) {
      if (top + this.lineHeight(line) < at - this.viewHeight) continue;
      if (top > at + 2 * this.viewHeight) break;
      first ||= line;
      last = line;
    }
    for (let line = first; line <= last; line++) this.measured.add(line);
    this.rendered = { first, last };
  }
}

/** Every other line wrapped, from the first: a project file's long paths in a narrow view. */
export function everyOtherLine(lines: number): number[] {
  return Array.from({ length: Math.ceil(lines / 2) }, (_, index) => 2 * index + 1);
}
