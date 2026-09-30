import { describe, expect, it } from 'vitest';
import type { FrameClock } from './frameClock';
import { createGraphViewport } from './graphViewport';
import { OVERSCROLL, toWorld, type Size, type Viewport } from './viewport';
import { GLIDE_MS } from './viewportGlide';
import { ZOOM_GLIDE_MAX_MS, ZOOM_STEP } from './zoom';

const FRAME_MS = 16;

/** Frames that run only when the test says, at a time the test sets. */
function fakeFrames() {
  let time = 1000;
  let nextId = 1;
  const pending = new Map<number, () => void>();
  const clock: FrameClock = {
    request: (callback) => {
      pending.set(nextId, callback);
      return nextId++;
    },
    cancel: (id) => void pending.delete(id),
    now: () => time,
  };
  /** Runs one frame `ms` after the last one. */
  const frame = (ms = FRAME_MS): void => {
    time += ms;
    const due = [...pending.values()];
    pending.clear();
    for (const callback of due) callback();
  };
  return {
    clock,
    frame,
    /** Lets time pass without a frame (a drag's pause). */
    wait: (ms: number) => void (time += ms),
    /** Runs frames until nothing asks for another; returns how many ran. */
    settle: (max = 2000): number => {
      let frames = 0;
      while (pending.size > 0 && frames < max) {
        frame();
        frames++;
      }
      return frames;
    },
    animating: () => pending.size > 0,
  };
}

const screen: Size = { width: 800, height: 600 };
const wideGraph: Size = { width: 4000, height: 3000 };

function viewportOf(content: Size = wideGraph, shown: Size = screen) {
  const frames = fakeFrames();
  const sizes = { content, screen: shown };
  const changes = { count: 0 };
  const view = createGraphViewport(
    { contentSize: () => sizes.content, screenSize: () => sizes.screen, onChange: () => changes.count++ },
    frames.clock,
  );
  return { view, frames, sizes, changes, at: (): Viewport => view.viewportRef.current };
}

/** A mouse drag from x to x + distance over `ms`, sampled every frame. */
function drag(subject: ReturnType<typeof viewportOf>, distanceX: number, ms: number): void {
  const { view, frames } = subject;
  const steps = Math.round(ms / FRAME_MS);
  let x = 400;
  view.inertia.sample(x, 300, subject.frames.clock.now());
  for (let step = 1; step <= steps; step++) {
    frames.wait(FRAME_MS);
    const next = 400 + (distanceX * step) / steps;
    view.panBy(next - x, 0);
    x = next;
    view.inertia.sample(x, 300, subject.frames.clock.now());
  }
}

describe('graph viewport: panning', () => {
  it('pans freely inside a graph larger than the screen, telling how far it moved', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -1000, panY: -1000, zoom: 1 });

    expect(subject.view.panBy(-50, 30)).toEqual({ dx: -50, dy: 30 });
    expect(subject.at()).toEqual({ panX: -1050, panY: -970, zoom: 1 });
  });

  it('stops at the edge of the graph, with a little room past it, and says it moved only that far', () => {
    const subject = viewportOf();

    expect(subject.view.panBy(500, 0)).toEqual({ dx: OVERSCROLL, dy: 0 });
    expect(subject.view.panBy(500, 0)).toEqual({ dx: 0, dy: 0 });
  });

  it('tells about a move only when the view moved', () => {
    const subject = viewportOf();
    subject.view.panBy(500, 0);
    const before = subject.changes.count;

    subject.view.panBy(500, 0);
    subject.view.keepInBounds();

    expect(subject.changes.count).toBe(before);
  });

  it('keeps no bounds before the canvas has a size', () => {
    const subject = viewportOf(wideGraph, { width: 0, height: 0 });

    subject.view.jumpTo({ panX: 5000, panY: 5000, zoom: 1 });

    expect(subject.at()).toEqual({ panX: 5000, panY: 5000, zoom: 1 });
  });

  it('brings the graph back on screen when it shrinks under the view', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -3000, panY: 0, zoom: 1 });

    subject.sizes.content = { width: 1000, height: 3000 };
    subject.view.keepInBounds();

    expect(subject.at().panX).toBe(screen.width - 1000 - OVERSCROLL);
  });
});

describe('graph viewport: a drag’s inertia', () => {
  it('glides on after a flick, in its direction, slowing down until it stops by itself', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -2000, panY: 0, zoom: 1 });
    drag(subject, -200, 80);
    const released = subject.at().panX;

    subject.view.inertia.release();
    subject.frames.frame();
    const firstStep = released - subject.at().panX;
    subject.frames.frame();
    const secondStep = released - firstStep - subject.at().panX;
    const frames = subject.frames.settle();

    expect(firstStep).toBeGreaterThan(0);
    expect(secondStep).toBeGreaterThan(0);
    expect(secondStep).toBeLessThan(firstStep);
    expect(frames).toBeLessThan(1000);
    expect(subject.frames.animating()).toBe(false);
  });

  it('parks where the drag let go after a pause or a slow drag', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -2000, panY: 0, zoom: 1 });
    drag(subject, -200, 80);
    subject.frames.wait(300);
    subject.view.inertia.release();
    expect(subject.frames.animating()).toBe(false);

    drag(subject, -10, 400);
    subject.view.inertia.release();
    expect(subject.frames.animating()).toBe(false);
  });

  it('stops gliding at the edge of the graph instead of pushing against it', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -100, panY: 0, zoom: 1 });
    drag(subject, 300, 60);

    subject.view.inertia.release();
    const frames = subject.frames.settle();

    expect(subject.at().panX).toBe(OVERSCROLL);
    expect(frames).toBeLessThan(10);
  });

  it('never jumps after a stalled frame', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -2000, panY: 0, zoom: 1 });
    drag(subject, -300, 60);
    subject.view.inertia.release();
    const released = subject.at().panX;

    subject.frames.frame(2000);

    // The glide starts at 5 px/ms at most (300 px over 60 ms): a 64 ms frame at most goes less than that times 64.
    expect(released - subject.at().panX).toBeLessThan(5 * 64);
  });

  it('stops dead when the user takes over', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -2000, panY: 0, zoom: 1 });
    drag(subject, -200, 80);
    subject.view.inertia.release();
    subject.frames.frame();

    subject.view.stop();
    const stoppedAt = subject.at();
    subject.frames.settle();

    expect(subject.at()).toEqual(stoppedAt);
  });
});

describe('graph viewport: zooming', () => {
  it('glides a zoom step to its zoom, keeping the world point under the pointer still all the way', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -1000, panY: -1000, zoom: 1 });
    const anchor = toWorld(subject.at(), 300, 200);

    subject.view.zoomStep(300, 200, ZOOM_STEP);
    subject.frames.frame();
    const midway = subject.at().zoom;
    subject.frames.settle();

    expect(midway).toBeGreaterThan(1);
    expect(midway).toBeLessThan(ZOOM_STEP);
    expect(subject.at().zoom).toBeCloseTo(ZOOM_STEP, 10);
    expect(toWorld(subject.at(), 300, 200).x).toBeCloseTo(anchor.x, 6);
    expect(toWorld(subject.at(), 300, 200).y).toBeCloseTo(anchor.y, 6);
  });

  it('compounds steps that come quickly, and lands within the longest glide', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -1000, panY: -1000, zoom: 1 });

    subject.view.zoomStep(400, 300, ZOOM_STEP);
    subject.frames.frame();
    subject.view.zoomStep(400, 300, ZOOM_STEP);
    const frames = subject.frames.settle();

    expect(subject.at().zoom).toBeCloseTo(ZOOM_STEP * ZOOM_STEP, 10);
    expect(frames * 16).toBeLessThanOrEqual(ZOOM_GLIDE_MAX_MS + 16);
  });

  it('follows a pinch at once, and a pinch freezes a zoom glide where it is', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -1000, panY: -1000, zoom: 1 });
    subject.view.zoomStep(400, 300, ZOOM_STEP);
    subject.frames.frame();
    const gliding = subject.at().zoom;

    subject.view.pinchZoom(400, 300, 1.1);
    subject.frames.settle();

    expect(subject.at().zoom).toBeCloseTo(gliding * 1.1, 10);
  });

  it('stops a drag’s glide when a zoom step comes', () => {
    const subject = viewportOf();
    subject.view.jumpTo({ panX: -2000, panY: -1000, zoom: 1 });
    drag(subject, -200, 80);
    subject.view.inertia.release();
    subject.frames.frame();

    const corner = toWorld(subject.at(), 0, 0);
    subject.view.zoomStep(0, 0, ZOOM_STEP);
    subject.frames.settle();

    // Only the zoom moved the view: the world point at the corner it zooms around is still there.
    expect(toWorld(subject.at(), 0, 0).x).toBeCloseTo(corner.x, 6);
    expect(toWorld(subject.at(), 0, 0).y).toBeCloseTo(corner.y, 6);
  });
});

describe('graph viewport: glides', () => {
  it('glides to a viewport, telling it glides until it lands exactly there', () => {
    const subject = viewportOf();
    const target = { panX: -1500, panY: -800, zoom: 0.8 };

    subject.view.glideTo(target);
    expect(subject.view.gliding()).toBe(true);
    const frames = subject.frames.settle();

    expect(subject.at()).toEqual(target);
    expect(subject.view.gliding()).toBe(false);
    expect(frames).toBe(Math.ceil(GLIDE_MS / FRAME_MS));
  });

  it('glides only as far as the bounds allow', () => {
    const subject = viewportOf();

    subject.view.glideTo({ panX: 3000, panY: -800, zoom: 1 });
    subject.frames.settle();

    expect(subject.at()).toEqual({ panX: OVERSCROLL, panY: -800, zoom: 1 });
  });

  it('is stopped by anything the user does, and by a jump', () => {
    for (const takeOver of [
      (view: ReturnType<typeof viewportOf>['view']) => view.stop(),
      (view: ReturnType<typeof viewportOf>['view']) => view.jumpTo({ panX: -100, panY: -100, zoom: 1 }),
      (view: ReturnType<typeof viewportOf>['view']) => view.pinchZoom(10, 10, 1.1),
      (view: ReturnType<typeof viewportOf>['view']) => view.zoomStep(10, 10, ZOOM_STEP),
    ]) {
      const subject = viewportOf();
      subject.view.glideTo({ panX: -3000, panY: -2000, zoom: 1 });
      subject.frames.frame();

      takeOver(subject.view);
      subject.frames.settle();

      expect(subject.view.gliding()).toBe(false);
      expect(subject.at().panX).not.toBe(-3000);
    }
  });
});
