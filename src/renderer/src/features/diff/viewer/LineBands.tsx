import { useMemo, type RefObject } from 'react';
import { bandLines, bandRect, firstLineKey, rangeBox, type LineBand } from './diffAnnotations';
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
 * A light outline around each line (or range of lines) a row or a marker is about (`LineBand`), across its pane's code: what a comment is
 * about reads at a glance, its card shown or folded into a marker. The one gone to is in the accent its card is.
 */
export function LineBands({ containerRef, bands, layout }: LineBandsProps) {
  const lines = useMemo(() => bandLines(bands), [bands]);
  const boxes = useLineBoxes(containerRef, lines, lines.map((line) => `${line.key}@${line.lineNumber}`).join('|'), layout);
  return (
    <>
      {bands.map((band) => {
        const box = rangeBox(boxes.get(firstLineKey(band.key)), boxes.get(band.key));
        if (!box) return null;
        return (
          <div
            key={band.key}
            className={styles.band}
            data-selected={band.selected || undefined}
            style={bandRect(box)}
          />
        );
      })}
    </>
  );
}
