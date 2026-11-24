// The part under the pointer while commenting on a model (`commentHover.ts` decides what it is and where its label
// goes). Picking reads the GPU (`ModelRenderer.pick`), so it runs at most once per frame, and only when the pointer
// or the model moved since the last pick (`pickAgain`): a turn's coast, a glide, a take or flying moves the model
// under a still pointer, and each frame drawn asks again (`onFrameDrawn`).

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isOnStageControl } from '../image/pointerDrag';
import { hoverLabelPlacement, hoverPicks, pickAgain, sameHoveredPart, type HoveredPart, type PickedAt } from './commentHover';
import type { ModelRenderer } from './modelRenderer';

interface CommentHoverOptions {
  /** The stage the pointer moves over. */
  element: RefObject<HTMLElement | null>;
  /** The label beside the cursor: placed here as the pointer moves, without React rendering for each move. */
  label: RefObject<HTMLElement | null>;
  /** What draws the model: when it moved (`moves`) and each frame it drew (`onFrameDrawn`). */
  renderer: Pick<ModelRenderer, 'moves' | 'onFrameDrawn'> | null;
  /** Commenting, and the stage takes comments: hovering shows nothing otherwise. */
  enabled: boolean;
  /**
   * The part under a point of the stage (CSS pixels from its top left), or none; picking it also places the ring where a
   * click would mark a point (`setCommentAim`), which shows only while `aimShownWhileCommenting` says so.
   */
  partAt: (x: number, y: number) => HoveredPart | null;
}

/**
 * The part under the pointer, and what places its label at the pointer (for the label's first draw). None while not
 * enabled, off the stage, over a stage control (a pin, a card, a button), or while a button is held (a drag orbits).
 * Turned on with the pointer already over the model (C), it picks at once.
 */
export function useCommentHover({ element, label, renderer, enabled, partAt }: CommentHoverOptions): { hovered: HoveredPart | null; wholePart: boolean; placeLabel: () => void } {
  const [hovered, setHovered] = useState<HoveredPart | null>(null);
  // Shift held: a click comments on the whole part. Followed from the keys too, so pressing or letting go of Shift
  // changes the light and the label at once, the pointer still.
  const [wholePart, setWholePart] = useState(false);
  const latestPartAt = useRef(partAt);
  latestPartAt.current = partAt;
  // Where the pointer is on the stage, while it may pick (`hoverPicks`): followed whether or not commenting, so C
  // pressed over the model lights the part at once.
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const placeLabel = useCallback(() => {
    const stage = element.current;
    const shown = label.current;
    if (!stage || !shown || !pointer.current) return;
    const { left, top } = hoverLabelPlacement(pointer.current, { width: shown.offsetWidth, height: shown.offsetHeight }, { width: stage.clientWidth, height: stage.clientHeight });
    shown.style.transform = `translate(${left}px, ${top}px)`;
  }, [element, label]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent): void => setWholePart(event.shiftKey);
    const onPointer = (event: PointerEvent): void => setWholePart(event.shiftKey);
    // Let go of elsewhere (the window left with Shift held): a point again.
    const onBlur = (): void => setWholePart(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('pointermove', onPointer);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('blur', onBlur);
      setWholePart(false);
    };
  }, [enabled]);

  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const follow = (event: PointerEvent): void => {
      const rect = target.getBoundingClientRect();
      pointer.current = hoverPicks(event, isOnStageControl(event)) ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
    };
    const leave = (): void => {
      pointer.current = null;
    };
    target.addEventListener('pointermove', follow);
    // A drag's end: the model may coast on under the pointer let go where it is.
    target.addEventListener('pointerup', follow);
    target.addEventListener('pointerdown', leave);
    target.addEventListener('pointerleave', leave);
    return () => {
      target.removeEventListener('pointermove', follow);
      target.removeEventListener('pointerup', follow);
      target.removeEventListener('pointerdown', leave);
      target.removeEventListener('pointerleave', leave);
    };
  }, [element]);

  useEffect(() => {
    const target = element.current;
    if (!enabled || !target || !renderer) return;
    let frame: number | null = null;
    let last: PickedAt | null = null;
    const clear = (): void => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      last = null;
      setHovered(null);
    };
    const pickNow = (): void => {
      frame = null;
      if (!pointer.current) return clear();
      const now = { ...pointer.current, moves: renderer.moves() };
      if (!pickAgain(last, now)) return;
      last = now;
      const part = latestPartAt.current(now.x, now.y);
      setHovered((shown) => (sameHoveredPart(shown, part) ? shown : part));
      placeLabel();
    };
    // Once a frame however often it's asked: by the pointer, a wheel, a frame drawn.
    const pickSoon = (): void => {
      frame ??= requestAnimationFrame(pickNow);
    };
    // Registered after the listener following the pointer (the effect above), so it reads where the pointer is now.
    const onPointerMove = (): void => (pointer.current ? pickSoon() : clear());
    const onFrameDrawn = (): void => {
      if (pointer.current) pickSoon();
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerMove);
    target.addEventListener('pointerdown', clear);
    target.addEventListener('pointerleave', clear);
    const stopFollowingFrames = renderer.onFrameDrawn(onFrameDrawn);
    pickSoon();
    return () => {
      clear();
      stopFollowingFrames();
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerup', onPointerMove);
      target.removeEventListener('pointerdown', clear);
      target.removeEventListener('pointerleave', clear);
    };
  }, [element, renderer, enabled, placeLabel]);

  return { hovered: enabled ? hovered : null, wholePart: enabled && wholePart, placeLabel };
}
