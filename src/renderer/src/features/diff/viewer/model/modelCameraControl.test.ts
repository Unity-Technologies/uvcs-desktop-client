import { describe, expect, it } from 'vitest';
import { wheelZoomFactor } from '../../../../lib/wheelZoom';
import { fakeFrames, FRAME_MS } from '../../../../testing/fakeFrames';
import { ModelCameraControl } from './modelCameraControl';
import { framedView, type BoundsLike, type OrbitView } from './orbitCamera';
import { regionView } from './regionView';
import { VIEW_GLIDE_MS } from './viewGlide';

const pair: BoundsLike = { min: [-1, -1, -1], max: [1, 1, 1] };
const part: BoundsLike = { min: [0.5, 0.5, 0.5], max: [1, 1, 1] };
/** A region on the model's back: from the first look, it faces away. */
const back: BoundsLike = { min: [-0.1, -0.1, -1], max: [0.1, 0.1, -0.9] };
const ASPECT = 1.5;
const NOTCH_IN = wheelZoomFactor(-100, 0);
const handView: OrbitView = { target: [0.2, 0, 0], yaw: 2, pitch: 0.4, distance: 7 };

/** A camera over the pair, as the viewer makes it; `glideMs` 0 is reduced motion. */
function camera({ glideMs = VIEW_GLIDE_MS, aspect = ASPECT } = {}) {
  const frames = fakeFrames();
  const moves: OrbitView[] = [];
  const interrupts: number[] = [];
  let paneAspect = aspect;
  const control = new ModelCameraControl({
    onCameraMove: (view) => moves.push(view),
    paneAspect: () => paneAspect,
    clock: frames.clock,
    glideMs: () => glideMs,
  });
  control.setInterrupt(() => interrupts.push(moves.length));
  control.setBounds(pair);
  return {
    control,
    frames,
    moves,
    interrupts,
    resize: (next: number) => {
      paneAspect = next;
      control.followResize();
    },
  };
}

/** A camera framed on the pair, as it opens. */
function framed(options?: { glideMs?: number }) {
  const made = camera(options);
  made.control.frameFirst();
  return made;
}

describe('ModelCameraControl', () => {
  it('frames the pair at once the first time, and never again over a view already placed', () => {
    const { control, frames, moves } = framed();
    expect(control.currentView()).toEqual(framedView(pair, ASPECT));
    expect(frames.animating()).toBe(false);
    control.onGesture(handView);
    control.frameFirst();
    expect(control.currentView()).toBe(handView);
    expect(moves.at(-1)).toBe(handView);
  });

  it('frames nothing before the pair is in the renderer', () => {
    const { control, frames, moves } = camera();
    control.setBounds(null);
    control.frameFirst();
    control.framePart(part);
    control.frameRegion(back);
    control.frameWhole();
    frames.settle();
    expect(moves).toEqual([]);
  });

  it('keeps the pair framed as the pane resizes, at once, until the hand moves the camera', () => {
    const { control, frames, resize } = framed();
    resize(0.5);
    expect(frames.animating()).toBe(false);
    expect(control.currentView()).toEqual(framedView(pair, 0.5));
    control.onGesture(handView);
    resize(2);
    expect(control.currentView()).toBe(handView);
  });

  it('keeps a part or a region framed as the pane resizes, never snapping back to the whole model', () => {
    for (const frameIt of [(control: ModelCameraControl) => control.framePart(part), (control: ModelCameraControl) => control.frameRegion(back)]) {
      const { control, frames, resize } = framed();
      frameIt(control);
      frames.settle();
      const there = control.currentView();
      resize(0.5);
      expect(control.currentView()).toBe(there);
    }
  });

  it('follows resizes again once the whole model is framed (0, or F with nothing picked)', () => {
    const { control, frames, resize } = framed();
    control.onGesture(handView);
    control.frameWhole();
    frames.settle();
    resize(0.5);
    expect(control.currentView()).toEqual(framedView(pair, 0.5, handView.yaw, handView.pitch));
  });

  it('glides to a part framed (a row picked, F on what is picked), keeping the angle, rather than jumping', () => {
    const { control, frames } = framed();
    control.onGesture(handView);
    control.framePart(part);
    expect(control.currentView()).toBe(handView);
    frames.frame(VIEW_GLIDE_MS / 2);
    expect(control.currentView().distance).not.toBe(handView.distance);
    frames.settle();
    expect(control.currentView()).toEqual(framedView(part, ASPECT, handView.yaw, handView.pitch));
  });

  it('glides to a changed region, turned to face it', () => {
    const { control, frames } = framed();
    const from = control.currentView();
    control.frameRegion(back);
    frames.settle();
    expect(control.currentView()).toEqual(regionView(back, pair, from, ASPECT));
  });

  it('places the camera at once when motion is reduced', () => {
    const { control, frames } = framed({ glideMs: 0 });
    const from = control.currentView();
    control.frameRegion(back);
    expect(control.currentView()).toEqual(regionView(back, pair, from, ASPECT));
    expect(frames.animating()).toBe(false);
  });

  it('places a framing at once when there is no view yet to glide from', () => {
    const { control, frames } = camera();
    control.framePart(part);
    expect(control.currentView()).toEqual(framedView(part, ASPECT));
    expect(frames.animating()).toBe(false);
  });

  it("stops the hand's moves still under way (a coast) before every framing the app makes, never before a gesture", () => {
    const { control, interrupts } = framed();
    expect(interrupts).toHaveLength(1);
    control.framePart(part);
    control.frameRegion(back);
    control.frameWhole();
    expect(interrupts).toHaveLength(4);
    control.onGesture(handView);
    control.onDollyStep(null, NOTCH_IN);
    expect(interrupts).toHaveLength(4);
  });

  it('lets a gesture take the camera at once from a glide, which never comes back', () => {
    const { control, frames } = framed();
    control.frameRegion(back);
    frames.frame(FRAME_MS * 3);
    control.onGesture(handView);
    frames.settle();
    expect(control.currentView()).toBe(handView);
  });

  it("lets the wheel take the camera from a glide, zooming from where the glide was", () => {
    const { control, frames } = framed();
    control.frameRegion(back);
    frames.frame(VIEW_GLIDE_MS / 2);
    const halfway = control.currentView();
    control.onDollyStep(null, NOTCH_IN);
    frames.settle();
    expect(control.currentView().target).toEqual(halfway.target);
    expect(control.currentView().distance).toBeCloseTo(halfway.distance / NOTCH_IN, 10);
  });

  it("stops a wheel's glide when the app frames something", () => {
    const { control, frames } = framed();
    control.onDollyStep(null, NOTCH_IN);
    frames.frame();
    const from = control.currentView();
    control.frameRegion(back);
    frames.settle();
    expect(control.currentView()).toEqual(regionView(back, pair, from, ASPECT));
  });

  it('tells every move of the camera, whatever made it, to `onCameraMove`', () => {
    const { control, frames, moves } = framed();
    control.frameRegion(back);
    frames.frame();
    expect(moves.at(-1)).toBe(control.currentView());
    control.onDollyStep(null, NOTCH_IN);
    frames.frame();
    expect(moves.at(-1)).toBe(control.currentView());
    control.onGesture(handView);
    expect(moves.at(-1)).toBe(handView);
  });
});
