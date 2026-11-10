import type { RefObject } from 'react';
import type { LineBand } from './diffAnnotations';
import type { CodeLayout } from './lineActions';
import { useLineBoxes } from './useLineBoxes';
import styles from './LineBands.module.css';

interface LineBandsProps {
  /** The scrolling element around the code, which the bands are placed in. */
  containerRef: RefObject<HTMLElement | null>;
  bands: readonly LineBand[];
  layout: CodeLayout;
}

/**
 * A light outline around each line a row or a marker is about (`LineBand`), across its pane's code: what a comment is
 * about reads at a glance, its card shown or folded into a marker. The one gone to is in the accent its card is.
 */
export function LineBands({ containerRef, bands, layout }: LineBandsProps) {
  const boxes = useLineBoxes(containerRef, bands, bands.map((band) => band.key).join('|'), layout);
  return (
    <>
      {bands.map((band) => {
        const box = boxes.get(band.key);
        if (!box) return null;
        return (
          <div
            key={band.key}
            className={styles.band}
            data-selected={band.selected || undefined}
            style={{ top: box.top, left: box.contentLeft, width: box.paneRight - box.contentLeft, height: box.bottom - box.top }}
          />
        );
      })}
    </>
  );
}
