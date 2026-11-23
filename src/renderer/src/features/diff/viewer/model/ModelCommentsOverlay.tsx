// The comments over a model's canvas (`ModelAnnotations`): each pin's bubble with its tip on its point, the opened
// pin's card beside it. The bubbles follow the model every frame the renderer draws (a turn, a glide, a take playing,
// a resize) by writing where they are straight to the page (`onFrameDrawn`): React renders for what changes the pins,
// never for each frame. Once the view stops moving, a pin whose point something else is drawn in front of shows
// faded and smaller (`hiddenBehind`), still there to click.

import { useLayoutEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { ModelSpot } from '@shared/domain/reviewConversation';
import { followDrag, isDragButton } from '../image/pointerDrag';
import { PinBubble } from '../pins/PinBubble';
import { boundsOf, PIN_CARD_WIDTH, pinCardPlacement } from '../pins/pinPlacement';
import pinStyles from '../pins/CommentPins.module.css';
import type { ModelAnnotations } from './modelAnnotations';
import { depthOfHit, hiddenBehind, type Projector, type ScreenPoint } from './modelProjection';
import type { ModelRenderer } from './modelRenderer';
import { pinPlacesOf, type DrawnVersion, type PinPlace } from './modelPinPlaces';
import type { Side } from './viewLayout';
import styles from './ModelCommentsOverlay.module.css';

/** How long the view stays still before what hides each pin's point is looked for: a pick per pin, never per frame. */
const SETTLE_MS = 150;

/** How far the pointer moves, in pixels, before a press on a comment being written drags it. */
const DRAG_THRESHOLD = 4;

interface ModelCommentsOverlayProps {
  annotations: ModelAnnotations;
  renderer: ModelRenderer;
  versions: Record<Side, DrawnVersion | null>;
  /** The model's size (its diagonal): how near a surface must be to hide a point behind it. */
  modelSize: number;
  /** The spot under a point of the canvas on a version: where a comment being written is dragged to. */
  spotAt: (x: number, y: number, side: Side, wholePart: boolean) => ModelSpot | null;
  /** The pin pointed at or focused, whose part may light up; none when none is. */
  onPointed: (key: string | null) => void;
}

export function ModelCommentsOverlay({ annotations, renderer, versions, modelSize, spotAt, onPointed }: ModelCommentsOverlayProps) {
  const places = useMemo(() => pinPlacesOf(annotations.pins, versions), [annotations.pins, versions]);
  const overlay = useRef<HTMLDivElement>(null);
  const bubbles = useRef(new Map<string, HTMLButtonElement>());
  const card = useRef<HTMLDivElement>(null);
  const opened = places.find((place) => place.pin.key === annotations.opened) ?? null;

  // Before the page paints: a card opened shows beside its pin from its first frame.
  useLayoutEffect(() => {
    let settle = 0;
    const onScreen = new Map<string, ScreenPoint>();
    let projectors: Record<Side, Projector | null> = { before: null, after: null };
    const place = (): void => {
      onScreen.clear();
      projectors = { before: renderer.screenProjectorOf('before'), after: renderer.screenProjectorOf('after') };
      for (const { pin, point } of places) {
        const bubble = bubbles.current.get(pin.key);
        if (!bubble) continue;
        const at = projectors[pin.side]?.(point()) ?? null;
        bubble.toggleAttribute('data-off-screen', at === null);
        if (!at) continue;
        onScreen.set(pin.key, at);
        bubble.style.transform = `translate(${at.x}px, ${at.y}px)`;
      }
      placeCard(onScreen);
      window.clearTimeout(settle);
      settle = window.setTimeout(markHidden, SETTLE_MS);
    };
    const placeCard = (screen: typeof onScreen): void => {
      const at = opened && screen.get(opened.pin.key);
      const box = overlay.current;
      if (!card.current || !box) return;
      card.current.toggleAttribute('data-off-screen', !at);
      if (!at) return;
      // A part comment's card leaves its part in view too, as it lights up while the card is open.
      const corners = opened.partCorners()?.flatMap((corner) => projectors[opened.pin.side]?.(corner) ?? []) ?? [];
      const placement = pinCardPlacement({ x: at.x, y: at.y, width: 0, height: 0 }, { width: box.clientWidth, height: box.clientHeight }, boundsOf(corners));
      Object.assign(card.current.style, { left: `${placement.left}px`, maxHeight: `${placement.maxHeight}px`, top: 'top' in placement ? `${placement.top}px` : '', bottom: 'bottom' in placement ? `${placement.bottom}px` : '' });
    };
    // What hides each point, picked under its bubble's tip on its own version once the view is still: something nearer.
    const markHidden = (): void => {
      const camera = renderer.cameraPosition();
      for (const { pin } of places) {
        const at = onScreen.get(pin.key);
        const bubble = bubbles.current.get(pin.key);
        if (!at || !bubble) continue;
        bubble.toggleAttribute('data-behind', hiddenBehind(at.depth, depthOfHit(renderer.pick(at.x, at.y), camera), modelSize));
      }
    };
    place();
    const stop = renderer.onFrameDrawn(place);
    return () => {
      stop();
      window.clearTimeout(settle);
    };
  }, [renderer, places, opened, modelSize]);

  return (
    <div ref={overlay} className={styles.overlay}>
      {places.map((place) => (
        <ModelPinBubble
          key={place.pin.key}
          place={place}
          selected={place.pin.key === annotations.selected || place.pin.key === annotations.opened}
          bubbleRef={(element) => {
            if (element) bubbles.current.set(place.pin.key, element);
            else bubbles.current.delete(place.pin.key);
          }}
          onOpen={() => annotations.onOpen(place.pin.key === annotations.opened ? null : place.pin.key)}
          onPointed={onPointed}
          onDragTo={(x, y) => {
            const spot = spotAt(x, y, place.pin.side, place.pin.spot.wholePart === true);
            if (spot) annotations.moveComment(place.pin.key, spot);
          }}
        />
      ))}
      {opened && (
        <div ref={card} className={pinStyles.card} data-no-pan="" style={{ width: PIN_CARD_WIDTH }}>
          {annotations.renderCard(opened.pin.key, { partGone: opened.partGone })}
        </div>
      )}
    </div>
  );
}

interface ModelPinBubbleProps {
  place: PinPlace;
  selected: boolean;
  bubbleRef: (element: HTMLButtonElement | null) => void;
  onOpen: () => void;
  onPointed: (key: string | null) => void;
  /** A comment being written dragged to a point of the canvas: its spot goes to what's under it. */
  onDragTo: (x: number, y: number) => void;
}

/** A pin's bubble, placed by the overlay each frame; a comment being written drags along the surface by it. */
function ModelPinBubble({ place, selected, bubbleRef, onOpen, onPointed, onDragTo }: ModelPinBubbleProps) {
  const { pin } = place;
  // A drag that moved the pin isn't a click on it.
  const dragged = useRef(false);
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!pin.movable || !isDragButton(event.button)) return;
    const bubble = event.currentTarget;
    const canvas = bubble.parentElement!.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY };
    dragged.current = false;
    followDrag(bubble, event.pointerId, (move) => {
      if (!dragged.current && Math.hypot(move.clientX - start.x, move.clientY - start.y) < DRAG_THRESHOLD) return;
      dragged.current = true;
      onDragTo(move.clientX - canvas.left, move.clientY - canvas.top);
    });
  };
  return (
    <PinBubble
      ref={bubbleRef}
      pin={pin}
      selected={selected}
      className={styles.bubble}
      onPointerDown={onPointerDown}
      onPointerEnter={() => onPointed(pin.key)}
      onPointerLeave={() => onPointed(null)}
      onFocus={() => onPointed(pin.key)}
      onBlur={() => onPointed(null)}
      onClick={() => {
        if (!dragged.current) onOpen();
        dragged.current = false;
      }}
    />
  );
}
