// The model viewer's camera and who may move it: the hand (a drag, the keys, a double-click, the wheel) and the app
// (the first framing, a resize, F, 0, a row picked, a changed region stepped to). Plain, so its rules are tested
// with fake frames; `useModelCamera` only wires it to React.

import type { FrameClock } from '../../../../lib/frameClock';
import type { ZoomGlide } from '../../../../lib/zoomGlide';
import { dollyGlide } from './dollyGlide';
import { framedView, type BoundsLike, type OrbitView, type Vector } from './orbitCamera';
import { regionView } from './regionView';
import { ViewGlide } from './viewGlide';

/** Where the camera is before anything frames: some view, so a gesture has one to start from. */
const ANY_VIEW = framedView({ min: [-1, -1, -1], max: [1, 1, 1] }, 1);

export interface ModelCameraOptions {
  /** Every move of the camera, whatever made it, is told here (`moveCamera`): the renderer draws it. */
  onCameraMove: (view: OrbitView) => void;
  /** The aspect of the pane a version is drawn in (width over height): framing fits it. */
  paneAspect: () => number;
  clock: FrameClock;
  /** How long the app's framings glide (`ViewGlide`); 0 places them at once, as reduced motion asks. */
  glideMs: () => number;
}

/**
 * The first framing frames the pair whole, at once. Until the hand moves the camera or the app frames a part of the
 * model, the pair stays framed as the pane resizes (the panel docking beside it, the window), at once; framing the
 * whole model again (0, F with nothing picked) follows resizes again. F, 0 and a row picked keep the camera's angle,
 * as Unity's F does; a changed region stepped to turns to face it (`regionView`). They glide there (`ViewGlide`), as
 * a wheel's notch does (`dollyGlide`); anything the hand does stops either glide where it is and carries on from
 * there, and the app's framings stop what the hand left moving first (`setInterrupt`: a drag's coast), as a coast's
 * next frame would otherwise take the camera back from the glide.
 */
export class ModelCameraControl {
  private view: OrbitView | null = null;
  /** The pair's bounds, once every version is in the renderer; null until then, when nothing frames. */
  private pair: BoundsLike | null = null;
  /** Whether the whole pair is what is framed, and so stays framed as the pane resizes. */
  private followsResizes = true;
  private interrupt: () => void = () => {};
  private readonly glide: ViewGlide;
  private readonly dolly: ZoomGlide<Vector | null>;

  constructor(private readonly options: ModelCameraOptions) {
    this.glide = new ViewGlide(() => this.currentView(), (view) => this.moveCamera(view), options.clock, options.glideMs);
    this.dolly = dollyGlide(
      () => this.currentView(),
      (view) => {
        this.followsResizes = false;
        this.moveCamera(view);
      },
      options.clock,
    );
  }

  /** The pair's bounds: null while a version isn't in the renderer yet (nothing frames for a layout not the pair's). */
  setBounds(pair: BoundsLike | null): void {
    this.pair = pair;
  }

  /** What stops the hand's moves still under way (a drag's coast); the app runs it before it takes the camera. */
  setInterrupt(interrupt: () => void): void {
    this.interrupt = interrupt;
  }

  currentView(): OrbitView {
    return this.view ?? ANY_VIEW;
  }

  /** Frames the pair once its models are in the renderer, unless the camera was placed already (the same pair read again). */
  frameFirst(): void {
    if (!this.view && this.pair) this.placeNow(this.framedOn(this.pair));
  }

  /** The pane resized: the pair is framed for it again, at once, while it is what is framed. */
  followResize(): void {
    if (this.followsResizes && this.view && this.pair) this.placeNow(this.framedOn(this.pair));
  }

  /** Frames the whole model (0, F with nothing picked), keeping the angle; resizes are followed again. */
  frameWhole(): void {
    if (!this.pair) return;
    this.glideTo(this.framedOn(this.pair));
    this.followsResizes = true;
  }

  /** Frames a part of the model (a row picked, F on what is picked), keeping the angle. */
  framePart(bounds: BoundsLike): void {
    if (!this.pair) return;
    this.glideTo(this.framedOn(bounds));
    this.followsResizes = false;
  }

  /** Takes the camera to a changed region, turned to face it when it doesn't face the camera (`regionView`). */
  frameRegion(region: BoundsLike): void {
    if (!this.pair) return;
    this.glideTo(regionView(region, this.pair, this.currentView(), this.options.paneAspect()));
    this.followsResizes = false;
  }

  /** What a gesture does: the hand has the camera from then on. */
  onGesture(view: OrbitView): void {
    this.followsResizes = false;
    this.stopGlides();
    this.moveCamera(view);
  }

  /** A wheel's notch: closer (`factor` over 1) or farther, towards the point under the pointer. */
  onDollyStep(point: Vector | null, factor: number): void {
    this.glide.stop();
    this.dolly.zoomStep(point, factor);
  }

  stopGlides(): void {
    this.glide.stop();
    this.dolly.stop();
  }

  private framedOn(bounds: BoundsLike): OrbitView {
    const aspect = this.options.paneAspect();
    return this.view ? framedView(bounds, aspect, this.view.yaw, this.view.pitch) : framedView(bounds, aspect);
  }

  /** The app's framing, glided to; with no view yet (nothing to glide from), placed at once. */
  private glideTo(view: OrbitView): void {
    if (!this.view) return this.placeNow(view);
    this.interrupt();
    this.dolly.stop();
    this.glide.glideTo(view);
  }

  private placeNow(view: OrbitView): void {
    this.interrupt();
    this.stopGlides();
    this.moveCamera(view);
  }

  /** The one place every move of the camera goes through, whatever made it: a gesture, a glide, a framing. */
  private moveCamera(view: OrbitView): void {
    this.view = view;
    this.options.onCameraMove(view);
  }
}
