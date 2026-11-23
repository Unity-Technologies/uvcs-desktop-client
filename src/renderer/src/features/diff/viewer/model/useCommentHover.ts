// The part under the pointer while commenting on a model (`commentHover.ts` decides what it is and where its label
// goes). Picking reads the GPU (`ModelRenderer.pick`), so it runs at most once per frame however fast the pointer
// moves, and never while a drag turns the model.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { isOnStageControl } from '../image/pointerDrag';
import { hoverLabelPlacement, sameHoveredPart, type HoveredPart } from './commentHover';

interface CommentHoverOptions {
  /** The stage the pointer moves over. */
  element: RefObject<HTMLElement | null>;
  /** The label beside the cursor: placed here as the pointer moves, without React rendering for each move. */
  label: RefObject<HTMLElement | null>;
  /** Commenting, and the stage takes comments: hovering shows nothing otherwise. */
  enabled: boolean;
  /** The part under a point of the stage (CSS pixels from its top left), or none. */
  partAt: (x: number, y: number) => HoveredPart | null;
}

/**
 * The part under the pointer, and what places its label at the pointer (for the label's first draw). None while not
 * enabled, off the stage, over a stage control (a pin, a card, a button), or while a button is held (a drag orbits).
 */
export function useCommentHover({ element, label, enabled, partAt }: CommentHoverOptions): { hovered: HoveredPart | null; placeLabel: () => void } {
  const [hovered, setHovered] = useState<HoveredPart | null>(null);
  const latestPartAt = useRef(partAt);
  latestPartAt.current = partAt;
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const placeLabel = useCallback(() => {
    const stage = element.current;
    const shown = label.current;
    if (!stage || !shown || !pointer.current) return;
    const { left, top } = hoverLabelPlacement(pointer.current, { width: shown.offsetWidth, height: shown.offsetHeight }, { width: stage.clientWidth, height: stage.clientHeight });
    shown.style.transform = `translate(${left}px, ${top}px)`;
  }, [element, label]);

  useEffect(() => {
    const target = element.current;
    if (!enabled || !target) return;
    let frame: number | null = null;
    const cancelFrame = (): void => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
    const clear = (): void => {
      cancelFrame();
      pointer.current = null;
      setHovered(null);
    };
    const pickNow = (): void => {
      frame = null;
      if (!pointer.current) return;
      const part = latestPartAt.current(pointer.current.x, pointer.current.y);
      setHovered((shown) => (sameHoveredPart(shown, part) ? shown : part));
      placeLabel();
    };
    const pickSoon = (event: MouseEvent): void => {
      const rect = target.getBoundingClientRect();
      pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      frame ??= requestAnimationFrame(pickNow);
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (event.buttons !== 0 || isOnStageControl(event)) return clear();
      pickSoon(event);
    };
    // A zoom moves the model under a still pointer.
    const onWheel = (event: WheelEvent): void => {
      if (!isOnStageControl(event)) pickSoon(event);
    };

    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerdown', clear);
    target.addEventListener('pointerleave', clear);
    target.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      clear();
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerdown', clear);
      target.removeEventListener('pointerleave', clear);
      target.removeEventListener('wheel', onWheel);
    };
  }, [element, enabled, placeLabel]);

  return { hovered: enabled ? hovered : null, placeLabel };
}
