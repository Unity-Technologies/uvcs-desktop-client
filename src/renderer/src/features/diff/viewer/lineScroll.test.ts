import type { Virtualizer } from '@pierre/diffs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { everyOtherLine, FakePierreLayout } from './fakePierreLayout';
import { A_THIRD_DOWN, scrollToLine } from './lineScroll';
import type { VirtualizerInternals } from './pierreLinePosition';

const VIEW_HEIGHT = 600;
const A_THIRD = VIEW_HEIGHT / 3;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scrollToLine, frame by frame, in a diff laid out as Pierre does', () => {
  it('brings a line a third of the way down', () => {
    const diff = new FakePierreLayout({ lines: 2000, wrapped: [], viewHeight: VIEW_HEIGHT });
    expect(scrollToLineIn(diff, 1500)).toBe(A_THIRD);
  });

  // A link to a line below wrapped lines (`#old-L187` of a project file) opened 4441 px above it: placed twice only,
  // the line moved again as the rows above it rendered taller than estimated.
  it('brings a line below wrapped lines a third of the way down', () => {
    const diff = new FakePierreLayout({ lines: 800, wrapped: everyOtherLine(800), viewHeight: VIEW_HEIGHT });
    expect(scrollToLineIn(diff, 187)).toBe(A_THIRD);
  });

  it('brings a line near the end of a wrapped diff as far up as the end of the content lets it', () => {
    const diff = new FakePierreLayout({ lines: 800, wrapped: everyOtherLine(800), viewHeight: VIEW_HEIGHT });
    scrollToLineIn(diff, 795);
    expect(diff.scrollTop).toBe(diff.maxScroll());
  });
});

/**
 * Runs `scrollToLine` on a scrolling element and a virtualizer standing for `diff`, frame by frame (its
 * `requestAnimationFrame`s), Pierre rendering what each frame scrolled to. Returns where the line stands below the top
 * of the view once it stopped and Pierre rendered what it scrolled to.
 */
function scrollToLineIn(diff: FakePierreLayout, lineNumber: number): number {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  const fileContainer = {} as Element;
  const container = {
    querySelector: (selector: string) => (selector === 'diffs-container' ? fileContainer : null),
    clientHeight: diff.viewHeight,
    get scrollHeight() {
      return diff.maxScroll() + diff.viewHeight;
    },
    get scrollTop() {
      return diff.scrollTop;
    },
    set scrollTop(top: number) {
      diff.scrollTo(top);
    },
  } as unknown as HTMLElement;
  const internals: VirtualizerInternals = {
    observers: new Map([[fileContainer, { top: 0, getLinePosition: (line: number) => ({ top: diff.lineTop(line), height: diff.lineHeight(line) }) }]]),
  };

  diff.startFrame();
  scrollToLine(container, { side: 'deletions', lineNumber }, internals as unknown as Virtualizer, A_THIRD_DOWN);
  diff.endFrame();
  for (let frame = 0; frame < 60 && frames.length > 0; frame++) {
    diff.startFrame();
    frames.splice(0).forEach((callback) => callback(frame));
    diff.endFrame();
  }
  diff.startFrame();
  diff.endFrame();
  return diff.lineTop(lineNumber) - diff.scrollTop;
}
