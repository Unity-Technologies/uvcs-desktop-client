// The comments over an image's viewport (`ImageAnnotations`): each pin where its spot shows, an area outlined, the
// opened pin's card beside it, and, while commenting, the surface a click or a drag marks a new comment's spot on.
// Positions are worked out in `imageSpotGeometry`; this maps them to the screen and follows the view's glide.

import { MessageSquarePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { Avatar } from '../../../../ui/Avatar';
import { anchoredOffset, type AnchorMode, type Size } from './composedFrame';
import type { ImageAnnotations, ImagePin, ImageSide } from './imageAnnotations';
import { cardPlacement, spotOfGesture, spotOnScreen, type ScreenRect } from './imageSpotGeometry';
import { followDrag, isDragButton } from './pointerDrag';
import type { PanZoom } from './usePanZoom';
import type { Point } from './viewTransform';
import styles from './ImageCommentsOverlay.module.css';

/** A card's width beside its pin: a thread reads as it does under a line of code, at a reading width. */
const CARD_WIDTH = 360;

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
}

export function ImageCommentsOverlay({ annotations, panZoom, frame, anchor, images, commenting, onCommented }: ImageCommentsOverlayProps) {
  const { transform, viewport, animated } = panZoom;
  const offsetOf = (side: ImageSide): Point | null => {
    const image = images[side];
    return image ? anchoredOffset(frame, image, anchor) : null;
  };
  const shown = annotations.pins.flatMap((pin) => {
    const offset = offsetOf(pin.side);
    return offset ? [{ pin, rect: spotOnScreen(pin.spot, offset, transform) }] : [];
  });
  const opened = shown.find(({ pin }) => pin.key === annotations.opened);
  const commentSide = annotations.commentsOn;
  const commentImage = commentSide && images[commentSide];
  const commentOffset = commentSide && offsetOf(commentSide);
  return (
    <div className={styles.overlay} data-gliding={animated || undefined}>
      {shown.map(({ pin, rect }) => (
        <PinMark
          key={pin.key}
          pin={pin}
          rect={rect}
          selected={pin.key === annotations.selected || pin.key === annotations.opened}
          onClick={() => annotations.onOpen(pin.key === annotations.opened ? null : pin.key)}
        />
      ))}
      {opened && viewport && <PinCard rect={opened.rect} viewport={viewport}>{annotations.renderCard(opened.pin.key)}</PinCard>}
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

/**
 * A pin: a speech bubble holding the avatar of who started the thread, its tip at its point (an area's top-left corner),
 * as a comment on a canvas reads in design tools; the area outlined.
 */
function PinMark({ pin, rect, selected, onClick }: { pin: ImagePin; rect: ScreenRect; selected: boolean; onClick: () => void }) {
  const flags = { 'data-emphasized': pin.emphasized || undefined, 'data-earlier': pin.earlier || undefined, 'data-selected': selected || undefined, 'data-writing': pin.author === null || undefined };
  return (
    <>
      {pin.spot.size && <div className={styles.area} {...flags} style={{ transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.width, height: rect.height }} />}
      <button
        type="button"
        className={styles.pin}
        {...flags}
        data-tip={pin.tip}
        aria-label={pin.tip}
        aria-pressed={selected}
        style={{ transform: `translate(${rect.x}px, ${rect.y}px)` }}
        onClick={onClick}
      >
        {pin.author === null ? <MessageSquarePlus size={14} aria-hidden /> : <Avatar user={pin.author} size={22} tip={null} />}
      </button>
    </>
  );
}

/** The opened pin's card, beside it and within the viewport, scrolling inside when taller than the room. */
function PinCard({ rect, viewport, children }: { rect: ScreenRect; viewport: Size; children: React.ReactNode }) {
  const placement = cardPlacement(rect, viewport, CARD_WIDTH);
  return (
    <div className={styles.card} data-no-pan="" style={{ left: placement.left, top: placement.top, width: CARD_WIDTH, maxHeight: placement.maxHeight }}>
      {children}
    </div>
  );
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
      {drag && <div className={styles.dragArea} style={dragBox(drag.start, drag.end)} />}
    </div>
  );
}

function dragBox(start: Point, end: Point): React.CSSProperties {
  return { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}
