import type { RefObject } from 'react';
import { markerSpots, type LineMarker } from './diffAnnotations';
import type { CodeLayout } from './lineActions';
import { useLineBoxes } from './useLineBoxes';
import styles from './LineMarkers.module.css';

interface LineMarkersProps {
  /** The scrolling element around the code, which the markers are placed in. */
  containerRef: RefObject<HTMLElement | null>;
  markers: readonly LineMarker[];
  layout: CodeLayout;
}

/**
 * A mark at the end of each marked line, in its pane, centered on the line: what's folded away there (a review's
 * comments while hidden) shows without taking a row, and a click opens it. Only the lines rendered have theirs; those
 * on one row sit side by side (`markerSpots`).
 */
export function LineMarkers({ containerRef, markers, layout }: LineMarkersProps) {
  const boxes = useLineBoxes(containerRef, markers, markers.map((marker) => marker.key).join('|'), layout);
  return (
    <>
      {markerSpots(markers, boxes).map((spot) => (
        <div key={spot.key} className={styles.spot} style={{ top: spot.top, left: spot.left }}>
          {spot.markers.map((marker) => (
            <button
              key={marker.key}
              type="button"
              className={styles.marker}
              data-emphasized={marker.emphasized || undefined}
              data-tip={marker.tip ?? marker.label}
              aria-label={marker.label}
              onClick={marker.onOpen}
            >
              {marker.content}
            </button>
          ))}
        </div>
      ))}
    </>
  );
}
