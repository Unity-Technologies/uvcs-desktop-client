import { describe, expect, it } from 'vitest';
import { CHANGE_SCROLL_START, changeScrollStep, type ChangeScrollFrame, type ChangeScrollStep } from './changeScrollPlan';
import type { ChangeScroll } from './changeView';

const VIEW_HEIGHT = 600;
const ROW = 20;
/** Three rows of context above the change (`CONTEXT_ROWS`). */
const PLACE = 3 * ROW;

const frame = (overrides: Partial<ChangeScrollFrame>): ChangeScrollFrame => ({
  why: 'move',
  rowOffset: null,
  placeOffset: PLACE,
  scrollTop: 0,
  maxScroll: 30_000,
  viewHeight: VIEW_HEIGHT,
  canJump: true,
  ...overrides,
});

describe('changeScrollStep', () => {
  it('jumps to where Pierre estimates a change not rendered yet, once', () => {
    const first = changeScrollStep(CHANGE_SCROLL_START, frame({}));
    expect(first.step).toEqual({ kind: 'jump' });
    expect(changeScrollStep(first.state, frame({})).step).toEqual({ kind: 'wait' });
  });

  it('waits for a change Pierre can tell nothing about yet', () => {
    expect(changeScrollStep(CHANGE_SCROLL_START, frame({ canJump: false })).step).toEqual({ kind: 'wait' });
  });

  it('scrolls smoothly to the rows of a change rendered already, on a move', () => {
    expect(changeScrollStep(CHANGE_SCROLL_START, frame({ rowOffset: 2000 })).step).toEqual({ kind: 'rows', smooth: true });
  });

  it('leaves a diff opening on a change that starts in view where it is', () => {
    expect(changeScrollStep(CHANGE_SCROLL_START, frame({ why: 'open', rowOffset: 100 })).step).toEqual({ kind: 'done' });
  });

  it('after a jump, places the change again until it stands in its place two frames in a row', () => {
    const jumped = changeScrollStep(CHANGE_SCROLL_START, frame({})).state;
    const moved = changeScrollStep(jumped, frame({ rowOffset: 1700, scrollTop: 4000 }));
    expect(moved.step).toEqual({ kind: 'place', scrollTop: 4000 + 1700 - PLACE });
    const once = changeScrollStep(moved.state, frame({ rowOffset: PLACE, scrollTop: 5640 }));
    expect(once.step).toEqual({ kind: 'wait' });
    const movedAgain = changeScrollStep(once.state, frame({ rowOffset: PLACE + 40, scrollTop: 5640 }));
    expect(movedAgain.step).toEqual({ kind: 'place', scrollTop: 5680 });
    const settling = changeScrollStep(movedAgain.state, frame({ rowOffset: PLACE, scrollTop: 5680 }));
    expect(settling.step).toEqual({ kind: 'wait' });
    expect(changeScrollStep(settling.state, frame({ rowOffset: PLACE, scrollTop: 5680 })).step).toEqual({ kind: 'done' });
  });

  it('after a jump, places a change in view too, rather than leave it where the estimate put it', () => {
    const jumped = changeScrollStep(CHANGE_SCROLL_START, frame({ why: 'open' })).state;
    expect(changeScrollStep(jumped, frame({ why: 'open', rowOffset: 400, scrollTop: 3600 })).step).toEqual({ kind: 'place', scrollTop: 3940 });
  });

  it('settles at the end of the content, where a change near the end of the file stands lower', () => {
    const jumped = changeScrollStep(CHANGE_SCROLL_START, frame({})).state;
    const atEnd = changeScrollStep(jumped, frame({ rowOffset: 500, scrollTop: 9000, maxScroll: 9000 }));
    expect(atEnd.step).toEqual({ kind: 'wait' });
    expect(changeScrollStep(atEnd.state, frame({ rowOffset: 500, scrollTop: 9000, maxScroll: 9000 })).step).toEqual({ kind: 'done' });
  });

  it('scrolls a diff opening on a change below the view to its rows, at once', () => {
    expect(changeScrollStep(CHANGE_SCROLL_START, frame({ why: 'open', rowOffset: 2000 })).step).toEqual({ kind: 'rows', smooth: false });
  });
});

describe('scrolling to a change, frame by frame, in a diff laid out as Pierre does', () => {
  it('brings a change rendered already, below the view, a few rows from the top', () => {
    const diff = new FakePierreDiff({ lines: 100, wrapped: [] });
    expect(diff.rowOffset(50)).toBeGreaterThan(VIEW_HEIGHT);
    expect(scrollToChangeIn(diff, 50, 'move')).toBe(PLACE);
  });

  it('brings the change of a diff without wrapped lines, not rendered yet, a few rows from the top', () => {
    const diff = new FakePierreDiff({ lines: 2000, wrapped: [] });
    expect(scrollToChangeIn(diff, 1500, 'move')).toBe(PLACE);
  });

  // A project file with wrapped lines: rows above the change measured taller than their estimate after the jump to it
  // moved it 1700 px below where it should have stood, as the next file's first change was stepped to.
  it.each<ChangeScroll>(['move', 'open'])('brings a change below wrapped lines a few rows from the top (%s)', (why) => {
    const diff = new FakePierreDiff({ lines: 800, wrapped: everyOther(800) });
    expect(scrollToChangeIn(diff, 187, why)).toBe(PLACE);
  });

  it('brings a change below wrapped lines as far up as the end of the content lets it', () => {
    const diff = new FakePierreDiff({ lines: 800, wrapped: everyOther(800) });
    expect(scrollToChangeIn(diff, 795, 'move')).toBe(diff.estimatedTop(795) - diff.maxScroll());
    expect(diff.scrollTop).toBe(diff.maxScroll());
  });
});

function everyOther(lines: number): number[] {
  return Array.from({ length: lines / 2 }, (_, index) => 2 * index + 1);
}

/**
 * Runs `changeScrollStep` over a diff laid out as Pierre lays one out, frame by frame as `scrollToChange` does: what
 * the step decides is done on the view, then Pierre renders the rows the scroll brought in. Returns where the change's
 * row stands below the top of the view once it's done.
 */
function scrollToChangeIn(diff: FakePierreDiff, line: number, why: ChangeScroll): number | null {
  let state = CHANGE_SCROLL_START;
  for (let frames = 0; frames < 60; frames++) {
    const decided = changeScrollStep(state, frame({ why, rowOffset: diff.rowOffset(line), scrollTop: diff.scrollTop, maxScroll: diff.maxScroll() }));
    state = decided.state;
    if (finishes(decided.step, diff, line)) break;
    diff.render();
  }
  diff.render();
  return diff.rowOffset(line);
}

/** Does a step on the fake diff as `scrollToChange` does on the view; whether scrolling stops there. */
function finishes(step: ChangeScrollStep, diff: FakePierreDiff, line: number): boolean {
  switch (step.kind) {
    case 'done':
      return true;
    case 'jump':
      diff.scrollTop = diff.estimatedTop(line) - PLACE;
      return false;
    case 'rows': {
      // `scrollToRows`: unless the row is in view, it goes a few rows from the top (where a smooth scroll ends).
      const offset = diff.rowOffset(line)!;
      if (offset < 0 || offset + diff.height(line) > VIEW_HEIGHT) diff.scrollTop += offset - PLACE;
      return true;
    }
    case 'place':
      diff.scrollTop = step.scrollTop;
      return false;
    case 'wait':
      return false;
  }
}

/**
 * A diff that renders only the rows in view, as Pierre's `Virtualizer` does: a line's height is estimated as one row
 * until it renders, then measured (a wrapped line, two rows). Rows render on the frame after a scroll, around the view.
 */
class FakePierreDiff {
  scrollTop = 0;
  private readonly measured = new Set<number>();
  private rendered: { first: number; last: number } = { first: 0, last: -1 };
  private readonly wrapped: Set<number>;
  private readonly lines: number;

  constructor({ lines, wrapped }: { lines: number; wrapped: number[] }) {
    this.lines = lines;
    this.wrapped = new Set(wrapped);
    this.render();
  }

  /** Where Pierre lays a line out: the heights it measured above it, and one row for each it hasn't. */
  estimatedTop(line: number): number {
    let top = 0;
    for (let above = 1; above < line; above++) top += this.measured.has(above) ? this.realHeight(above) : ROW;
    return top;
  }

  height(line: number): number {
    return this.measured.has(line) ? this.realHeight(line) : ROW;
  }

  /** Where a line's row stands below the top of the view; null while it isn't rendered. */
  rowOffset(line: number): number | null {
    return line >= this.rendered.first && line <= this.rendered.last ? this.estimatedTop(line) - this.scrollTop : null;
  }

  maxScroll(): number {
    return Math.max(0, this.estimatedTop(this.lines + 1) - VIEW_HEIGHT);
  }

  /** Renders the rows in view and a view's worth around them, measuring their heights. */
  render(): void {
    const overscan = VIEW_HEIGHT;
    this.scrollTop = Math.min(Math.max(0, this.scrollTop), this.maxScroll());
    let first = 0;
    let last = 0;
    for (let line = 1; line <= this.lines; line++) {
      const top = this.estimatedTop(line);
      if (top + this.height(line) < this.scrollTop - overscan) continue;
      if (top > this.scrollTop + VIEW_HEIGHT + overscan) break;
      first ||= line;
      last = line;
    }
    for (let line = first; line <= last; line++) this.measured.add(line);
    this.rendered = { first, last };
  }

  private realHeight(line: number): number {
    return this.wrapped.has(line) ? 2 * ROW : ROW;
  }
}
