import type { RefObject } from 'react';
import type { LineMarker } from './diffAnnotations';
import type { CodeLayout } from './lineActions';
import { useLineBoxes } from './useLineBoxes';
import styles from './LineMarkers.module.css';

interface LineMarkersProps {
  /** The scrolling element around the code, which the markers are placed in. */
  containerRef: RefObject<HTMLElement | null>;
  markers: readonly LineMarker[];
  layout: CodeLayout;
}

/** The room between a marker and the right edge of its pane. */
const MARKER_INSET = 8;

/**
 * A mark at the end of each marked line, in its pane, centered on the line: what's folded away there (a review's
 * comments while hidden) shows without taking a row, and a click opens it. Only the lines rendered have theirs.
 */
export function LineMarkers({ containerRef, markers, layout }: LineMarkersProps) {
  const boxes = useLineBoxes(containerRef, markers, markers.map((marker) => marker.key).join('|'), layout);
  return (
    <>
      {markers.map((marker) => {
        const box = boxes.get(marker.key);
        if (!box) return null;
        return (
          <button
            key={marker.key}
            type="button"
            className={styles.marker}
            style={{ top: (box.top + box.bottom) / 2, left: box.paneRight - MARKER_INSET }}
            data-emphasized={marker.emphasized || undefined}
            data-tip={marker.label}
            aria-label={marker.label}
            onClick={marker.onOpen}
          >
            {marker.content}
          </button>
        );
      })}
    </>
  );
}
