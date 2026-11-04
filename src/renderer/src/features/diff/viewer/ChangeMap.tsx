import { useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react';
import { prefersReducedMotion } from '../../../lib/reducedMotion';
import { changeMarkLabel, scrollTopForTrackPoint } from './changeMarks';
import { scrollTopAfterDrag, thumbOf } from './diffScrollbar';
import { scrollSmoothlyTo } from './smoothScrollPlan';
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

const THUMB = { 'data-thumb': '' } as const;

/**
 * The change map: the diff's own vertical scrollbar while it has changes to show, with the changes marked in its track
 * (a block per change, close ones fused into a band) and its thumb drawn over them, translucent. Dragging the thumb
 * scrolls the diff. A press anywhere else in the track, on a block or not, scrolls smoothly to center that point
 * (`scrollTopForTrackPoint`; far away, it jumps and glides only the end: `smoothScrollPlan`) and drags on from there,
 * as macOS's scrollbars do. The keys and the arrows step from change to change, so it's for the pointer only.
 *
 * It's inside the diff's scrolling element, first, standing still at its top (`ChangeMap.module.css`), so the wheel
 * over it scrolls the diff as anywhere else. A press on it takes no focus, and it's no press in the diff: the caret
 * typing in the diff stays where it was, and the lines aren't picked.
 */
export function ChangeMap({ view, count, containerRef }: ChangeMapProps) {
  const scrollTop = useScrollTop(containerRef);
  const geometry = { contentHeight: view.contentHeight, viewHeight: view.viewHeight, trackHeight: view.trackHeight };
  const thumb = thumbOf({ ...geometry, scrollTop });
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    const container = containerRef.current;
    if (event.button !== 0 || !container) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    let startScrollTop = container.scrollTop;
    if (!(event.target as Element).closest('[data-thumb]')) {
      startScrollTop = scrollTopForTrackPoint(event.clientY - event.currentTarget.getBoundingClientRect().top, geometry);
      scrollSmoothlyTo(container, startScrollTop, prefersReducedMotion());
    }
    drag.current = { startY: event.clientY, startScrollTop };
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const container = containerRef.current;
    if (!drag.current || !container || event.clientY === drag.current.startY) return;
    container.scrollTop = scrollTopAfterDrag(drag.current.startScrollTop, event.clientY - drag.current.startY, geometry);
  };
  const onPointerUp = (): void => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      className={styles.track}
      style={{ height: view.trackHeight, marginBottom: -view.trackHeight, ...colorProperties(view) }}
      aria-hidden
      onMouseDown={(event) => event.preventDefault()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {view.marks.map((mark) => (
        <div key={mark.first} className={styles.mark} style={{ top: mark.top, height: mark.height }} data-kind={mark.kind} data-tip={changeMarkLabel(mark, count)} />
      ))}
      <div className={styles.thumb} style={{ top: thumb.top, height: thumb.height }} data-dragging={dragging ? '' : undefined} {...THUMB} />
    </div>
  );
}

/** The changed rows' own tints, for the marks (`ChangeMap.module.css`). */
function colorProperties({ colors }: ChangeMapView): CSSProperties {
  return { '--map-deleted': colors.deleted, '--map-added': colors.added, colorScheme: colors.colorScheme } as CSSProperties;
}
