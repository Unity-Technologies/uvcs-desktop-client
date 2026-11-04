import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { prefersReducedMotion } from '../../../lib/reducedMotion';
import { changeMarkLabel, scrollTopForTrackPoint } from './changeMarks';
import { scrollSmoothlyTo } from './smoothScrollPlan';
import { scrollTopAfterDrag, thumbOf } from './diffScrollbar';
import type { ChangeMapView } from './useChangeMap';
import { useScrollTop } from './useScrollTop';
import styles from './ChangeMap.module.css';

interface ChangeMapProps {
  view: ChangeMapView;
  /** How many changes the diff has, for the marks' tooltips ("Change 3 of 12"). */
  count: number;
  /** The diff's scrolling element, which this scrolls. */
  containerRef: RefObject<HTMLElement | null>;
}

interface Drag {
  startY: number;
  startScrollTop: number;
}

/**
 * The change map: the diff's own vertical scrollbar while it has changes to show, with the changes marked in its track
 * (a block per change, close ones fused into a band) and its thumb drawn over them, translucent. Dragging the
 * thumb scrolls the diff; a click anywhere in the track, on a block or not, scrolls smoothly to center that point
 * (`scrollTopForTrackPoint`; far away, it jumps and glides only the end: `smoothScrollPlan`). The keys and the arrows
 * step from change to change, so it's for the pointer only.
 *
 * It's inside the diff's scrolling element, first, standing still at its top (`ChangeMap.module.css`), so the wheel
 * over it scrolls the diff as anywhere else. A press on it takes no focus, and it's no press in the diff: the caret
 * typing in the diff stays where it was, and the lines aren't picked.
 */
export function ChangeMap({ view, count, containerRef }: ChangeMapProps) {
  const scrollTop = useScrollTop(containerRef);
  const geometry = { contentHeight: view.contentHeight, viewHeight: view.viewHeight, trackHeight: view.viewHeight };
  const thumb = thumbOf({ ...geometry, scrollTop });
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  const onTrackClick = (event: MouseEvent<HTMLDivElement>): void => {
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const top = scrollTopForTrackPoint(y, { contentHeight: view.contentHeight, stripHeight: view.viewHeight, viewHeight: view.viewHeight });
    const container = containerRef.current;
    if (container) scrollSmoothlyTo(container, top, prefersReducedMotion());
  };
  const onThumbDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startScrollTop: containerRef.current?.scrollTop ?? 0 };
    setDragging(true);
  };
  const onThumbMove = (event: PointerEvent<HTMLDivElement>): void => {
    const container = containerRef.current;
    if (!drag.current || !container) return;
    container.scrollTop = scrollTopAfterDrag(drag.current.startScrollTop, event.clientY - drag.current.startY, geometry);
  };
  const onThumbUp = (): void => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      className={styles.track}
      style={{ height: view.viewHeight, marginBottom: -view.viewHeight, ...colorProperties(view) }}
      aria-hidden
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onTrackClick}
    >
      {view.marks.map((mark) => (
        <div
          key={mark.first}
          className={styles.mark}
          style={{ top: mark.top, height: mark.height }}
          data-kind={mark.kind}
          data-tip={changeMarkLabel(mark, count)}
        />
      ))}
      <div
        className={styles.thumb}
        style={{ top: thumb.top, height: thumb.height }}
        data-dragging={dragging ? '' : undefined}
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
        // A drag ends with a click on the thumb: it's no click in the track.
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

/** The changed rows' own tints, for the marks (`ChangeMap.module.css`). */
function colorProperties({ colors }: ChangeMapView): CSSProperties {
  return { '--map-deleted': colors.deleted, '--map-added': colors.added, colorScheme: colors.colorScheme } as CSSProperties;
}
