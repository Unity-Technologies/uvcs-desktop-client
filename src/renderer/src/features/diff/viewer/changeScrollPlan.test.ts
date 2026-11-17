import { describe, expect, it } from 'vitest';
import { CHANGE_SCROLL_START, changeScrollStep, type ChangeScroll, type ChangeScrollFrame, type ChangeScrollStep } from './changeScrollPlan';
import { everyOtherLine, FAKE_ROW_HEIGHT, FakePierreLayout } from './fakePierreLayout';

const VIEW_HEIGHT = 600;
/** Three rows of context above the change (`CONTEXT_ROWS`). */
const PLACE = 3 * FAKE_ROW_HEIGHT;

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
    expect(atEnd.step).toEqual({ kind: 'place', scrollTop: 9000 });
    const settling = changeScrollStep(atEnd.state, frame({ rowOffset: 500, scrollTop: 9000, maxScroll: 9000 }));
    expect(settling.step).toEqual({ kind: 'wait' });
    expect(changeScrollStep(settling.state, frame({ rowOffset: 500, scrollTop: 9000, maxScroll: 9000 })).step).toEqual({ kind: 'done' });
  });

  it('after a jump, leaves the view where the user scrolls it while the change stands still', () => {
    const jumped = changeScrollStep(CHANGE_SCROLL_START, frame({})).state;
    const placed = changeScrollStep(jumped, frame({ rowOffset: 1700, scrollTop: 4000 }));
    const scrolled = changeScrollStep(placed.state, frame({ rowOffset: PLACE - 300, scrollTop: 5640 + 300 }));
    expect(scrolled.step).toEqual({ kind: 'wait' });
    expect(changeScrollStep(scrolled.state, frame({ rowOffset: PLACE - 700, scrollTop: 5640 + 700 })).step).toEqual({ kind: 'done' });
  });

  it('scrolls a diff opening on a change below the view to its rows, at once', () => {
    expect(changeScrollStep(CHANGE_SCROLL_START, frame({ why: 'open', rowOffset: 2000 })).step).toEqual({ kind: 'rows', smooth: false });
  });
});

describe('scrolling to a change, frame by frame, in a diff laid out as Pierre does', () => {
  const layout = (lines: number, wrapped: number[] = []): FakePierreLayout => new FakePierreLayout({ lines, wrapped, viewHeight: VIEW_HEIGHT });

  it('brings a change rendered already, below the view, a few rows from the top', () => {
    const diff = layout(100);
    expect(diff.rowOffset(50)).toBeGreaterThan(VIEW_HEIGHT);
    expect(scrollToChangeIn(diff, 50, 'move')).toBe(PLACE);
  });

  it('brings the change of a diff without wrapped lines, not rendered yet, a few rows from the top', () => {
    expect(scrollToChangeIn(layout(2000), 1500, 'move')).toBe(PLACE);
  });

  // A project file with wrapped lines: rows above the change measured taller than their estimate after the jump to it
  // moved it 1700 px below where it should have stood, as the next file's first change was stepped to.
  it.each<ChangeScroll>(['move', 'open'])('brings a change below wrapped lines a few rows from the top (%s)', (why) => {
    expect(scrollToChangeIn(layout(800, everyOtherLine(800)), 187, why)).toBe(PLACE);
  });

  it('brings a change below wrapped lines as far up as the end of the content lets it', () => {
    const diff = layout(800, everyOtherLine(800));
    expect(scrollToChangeIn(diff, 795, 'move')).toBe(diff.lineTop(795) - diff.maxScroll());
    expect(diff.scrollTop).toBe(diff.maxScroll());
  });
});

/**
 * Runs `changeScrollStep` over a diff laid out as Pierre lays one out, frame by frame as `scrollToChange` does: what
 * the step decides is done on the view, and Pierre renders what the scrolls brought in. Returns where the change's row
 * stands below the top of the view once it's done and Pierre rendered what it scrolled to.
 */
function scrollToChangeIn(diff: FakePierreLayout, line: number, why: ChangeScroll): number | null {
  let state = CHANGE_SCROLL_START;
  for (let frames = 0; frames < 60; frames++) {
    diff.startFrame();
    const decided = changeScrollStep(state, frame({ why, rowOffset: diff.rowOffset(line), scrollTop: diff.scrollTop, maxScroll: diff.maxScroll() }));
    state = decided.state;
    const finished = finishes(decided.step, diff, line);
    diff.endFrame();
    if (finished) break;
  }
  diff.startFrame();
  diff.endFrame();
  return diff.rowOffset(line);
}

/** Does a step on the fake diff as `scrollToChange` does on the view; whether scrolling stops there. */
function finishes(step: ChangeScrollStep, diff: FakePierreLayout, line: number): boolean {
  switch (step.kind) {
    case 'done':
      return true;
    case 'jump':
      diff.scrollTo(diff.lineTop(line) - PLACE);
      return false;
    case 'rows': {
      // `scrollToRows`: unless the row is in view, it goes a few rows from the top (where a smooth scroll ends).
      const offset = diff.rowOffset(line)!;
      if (offset < 0 || offset + diff.lineHeight(line) > VIEW_HEIGHT) diff.scrollTo(diff.scrollTop + offset - PLACE);
      return true;
    }
    case 'place':
      diff.scrollTo(step.scrollTop);
      return false;
    case 'wait':
      return false;
  }
}
