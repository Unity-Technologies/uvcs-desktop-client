// The comments over an image's viewport (`ImageAnnotations`): each pin where its spot shows, an area outlined, the
// opened pin's card beside it, and, while commenting, the surface a click or a drag marks a new comment's spot on.
// Positions are worked out in `imageSpotGeometry`; this maps them to the screen and follows the view's glide.

import { useRef, useState } from 'react';
import type { ImageSpot } from '@shared/domain/reviewConversation';
import { useKeptElement } from '../../../../lib/useKeptElement';
import { PinBubble } from '../pins/PinBubble';
import { PinCard } from '../pins/PinCard';
import type { ScreenRect } from '../pins/pinPlacement';
import { anchoredOffset, type AnchorMode, type Size } from './composedFrame';
import type { ImageAnnotations, ImagePin, ImageSide } from './imageAnnotations';
import { AREA_CORNERS, AREA_DRAG_THRESHOLD, cornerPoint, dragRect, imagePointAt, movedSpot, resizedSpot, spotOfGesture, spotOnScreen, type AreaCorner } from './imageSpotGeometry';
import { followDrag, isDragButton } from './pointerDrag';
import type { PanZoom } from './usePanZoom';
import type { Point } from './viewTransform';
import styles from './ImageCommentsOverlay.module.css';

interface ImageCommentsOverlayProps {
  annotations: ImageAnnotations;
  panZoom: PanZoom;
  frame: Size;
  anchor: AnchorMode;
  /** The images this viewport shows, by side: where each sits in the frame places its pins. */
  images: Partial<Record<ImageSide, Size>>;
  /** Marking a new comment's spot: the pointer marks it rather than panning. */
  commenting: boolean;
  /** A spot was marked, or the gesture ended off the image. */
  onCommented: () => void;
  /** The layer over the whole stage the opened pin's card shows in: Split's narrow pane would cut it off. */
  cardLayer: HTMLElement | null;
}

export function ImageCommentsOverlay({ annotations, panZoom, frame, anchor, images, commenting, onCommented, cardLayer }: ImageCommentsOverlayProps) {
  const { transform, animated } = panZoom;
  const [pane, keepPane] = useKeptElement<HTMLDivElement>();
  const offsetOf = (side: ImageSide): Point | null => {
    const image = images[side];
    return image ? anchoredOffset(frame, image, anchor) : null;
  };
  const shown = annotations.pins.flatMap((pin) => {
    const offset = offsetOf(pin.side);
    const image = images[pin.side];
    return offset && image ? [{ pin, rect: spotOnScreen(pin.spot, offset, transform), offset, image }] : [];
  });
  const opened = shown.find(({ pin }) => pin.key === annotations.opened);
  const commentSide = annotations.commentsOn;
  const commentImage = commentSide && images[commentSide];
  const commentOffset = commentSide && offsetOf(commentSide);
  return (
    <div ref={keepPane} className={styles.overlay} data-gliding={animated || undefined}>
      {shown.map(({ pin, rect, offset, image }) => (
        <PinMark
          key={pin.key}
          pin={pin}
          rect={rect}
          selected={pin.key === annotations.selected || pin.key === annotations.opened}
          opened={pin.key === annotations.opened}
          onClick={() => annotations.onOpen(pin.key === annotations.opened ? null : pin.key)}
          reshape={
            pin.movable
              ? {
                  scale: transform.scale,
                  toImage: (point) => imagePointAt(point, transform, offset),
                  image,
                  onChange: (spot) => annotations.moveComment(pin.key, spot),
                }
              : null
          }
        />
      ))}
      {opened && (
        <PinCard rect={opened.rect} pane={pane} layer={cardLayer}>
          {annotations.renderCard(opened.pin.key)}
        </PinCard>
      )}
      {commenting && commentImage && commentOffset && (
        <CommentGesture
          onMarked={(start, end) => {
            const spot = spotOfGesture(start, end, transform, commentOffset, commentImage);
            if (spot) annotations.addComment(spot);
            onCommented();
          }}
        />
      )}
    </div>
  );
}

/** How a movable pin's spot changes as it's dragged: in its image's pixels. */
interface Reshape {
  scale: number;
  /** A point of the viewport, in the image's pixels. */
  toImage: (point: Point) => Point;
  image: Size;
  onChange: (spot: ImageSpot) => void;
}

/**
 * A pin: a speech bubble holding the avatar of who started the thread, its tip at its point (an area's top-left corner),
 * as a comment on a canvas reads in design tools; the area outlined. A movable one (a comment being written) drags by
 * its bubble, and its area's corners reshape it.
 */
function PinMark({ pin, rect, selected, opened, onClick, reshape }: { pin: ImagePin; rect: ScreenRect; selected: boolean; opened: boolean; onClick: () => void; reshape: Reshape | null }) {
  const flags = { 'data-emphasized': pin.emphasized || undefined, 'data-earlier': pin.earlier || undefined, 'data-selected': selected || undefined, 'data-writing': pin.author === null || undefined };
  // A drag that moved the pin isn't a click on it.
  const dragged = useRef(false);
  const onBubbleDown = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (!reshape || !isDragButton(event.button)) return;
    const start = { x: event.clientX, y: event.clientY };
    const from = pin.spot;
    dragged.current = false;
    followDrag(event.currentTarget, event.pointerId, (move) => {
      const dx = move.clientX - start.x;
      const dy = move.clientY - start.y;
      if (!dragged.current && Math.hypot(dx, dy) < AREA_DRAG_THRESHOLD) return;
      dragged.current = true;
      reshape.onChange(movedSpot(from, { x: dx / reshape.scale, y: dy / reshape.scale }, reshape.image));
    });
  };
  return (
    <>
      {pin.spot.size && <div className={styles.area} {...flags} data-opened={opened || undefined} style={{ transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.width, height: rect.height }} />}
      {pin.spot.size && reshape && AREA_CORNERS.map((corner) => <CornerHandle key={corner} corner={corner} rect={rect} spot={pin.spot} reshape={reshape} />)}
      <PinBubble
        pin={pin}
        selected={selected}
        className={styles.bubble}
        style={{ transform: `translate(${rect.x}px, ${rect.y}px)` }}
        onPointerDown={onBubbleDown}
        onClick={() => {
          if (!dragged.current) onClick();
          dragged.current = false;
        }}
      />
    </>
  );
}

/** A corner of an area being written on, dragged to reshape it. */
function CornerHandle({ corner, rect, spot, reshape }: { corner: AreaCorner; rect: ScreenRect; spot: ImageSpot; reshape: Reshape }) {
  const { x, y } = cornerPoint(rect, corner);
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!isDragButton(event.button)) return;
    event.preventDefault();
    const viewport = event.currentTarget.parentElement!.getBoundingClientRect();
    followDrag(event.currentTarget, event.pointerId, (move) =>
      reshape.onChange(resizedSpot(spot, corner, reshape.toImage({ x: move.clientX - viewport.left, y: move.clientY - viewport.top }), reshape.image)),
    );
  };
  return <div className={styles.corner} data-corner={corner} data-no-pan="" style={{ transform: `translate(${x}px, ${y}px)` }} onPointerDown={onPointerDown} />;
}

/** Where the pointer marks a new comment: a press and release, the area dragged between them outlined meanwhile. */
function CommentGesture({ onMarked }: { onMarked: (start: Point, end: Point) => void }) {
  const surface = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ start: Point; end: Point } | null>(null);
  const pointIn = (event: { clientX: number; clientY: number }): Point => {
    const box = surface.current!.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!isDragButton(event.button) || !surface.current) return;
    event.preventDefault();
    const start = pointIn(event);
    let end = start;
    setDrag({ start, end });
    followDrag(
      surface.current,
      event.pointerId,
      (move) => {
        end = pointIn(move);
        setDrag({ start, end });
      },
      () => {
        setDrag(null);
        onMarked(start, end);
      },
    );
  };
  return (
    <div ref={surface} className={styles.gesture} data-no-pan="" onPointerDown={onPointerDown}>
      {drag && <div className={styles.dragArea} style={boxStyle(dragRect(drag.start, drag.end))} />}
    </div>
  );
}

function boxStyle(rect: ScreenRect): React.CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}
