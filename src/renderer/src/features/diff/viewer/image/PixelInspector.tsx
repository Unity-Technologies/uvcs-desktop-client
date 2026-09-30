// The pixel inspector: from 8× zoom, hovering tells the pixel under the pointer, its position in the composed frame
// and its color before → after, with swatches. The sample is state of its own, so a pointer move re-renders only this.

import { useEffect, useRef, useState, type RefObject } from 'react';
import { anchoredOffset, type AnchorMode, type Size } from './imageDiff';
import { colorHex, type Rgba } from './imageInfo';
import { isOnStageControl } from './pointerDrag';
import { rasterize } from './rasterize';
import { VIEWPORT_ATTRIBUTE } from './stage';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';
import { framePixelAt } from './viewTransform';
import styles from './PixelInspector.module.css';

/** The inspector works from this zoom: a pixel is then 8 screen pixels or more, so the pointer can point at one. */
const MIN_INSPECT_ZOOM = 8;

interface Sample {
  /** In the composed frame, where both revisions are laid out. */
  x: number;
  y: number;
  /** Null where that revision doesn't cover the pixel (revisions of different sizes). */
  old: Rgba | null;
  new: Rgba | null;
}

interface PixelInspectorProps {
  oldImage: DecodedImage | null;
  newImage: DecodedImage | null;
  frame: Size;
  anchor: AnchorMode;
  panZoom: PanZoom;
  /** The stage element to listen on. */
  stageRef: RefObject<HTMLDivElement | null>;
}

export function PixelInspector({ oldImage, newImage, frame, anchor, panZoom, stageRef }: PixelInspectorProps) {
  const [sample, setSample] = useState<Sample | null>(null);
  // Read by the listener, so it isn't bound again at every pan.
  const transform = useRef(panZoom.transform);
  transform.current = panZoom.transform;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const clear = (): void => setSample(null);
    const onMove = (event: PointerEvent): void => {
      const viewport = event.target instanceof Element ? event.target.closest(`[${VIEWPORT_ATTRIBUTE}]`) : null;
      const rect = viewport?.getBoundingClientRect();
      const pixel =
        rect && transform.current.scale >= MIN_INSPECT_ZOOM && !isOnStageControl(event)
          ? framePixelAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, transform.current, frame)
          : null;
      setSample(pixel && { ...pixel, old: colorAt(oldImage, frame, anchor, pixel), new: colorAt(newImage, frame, anchor, pixel) });
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', clear);
    return () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', clear);
      clear();
    };
  }, [stageRef, frame, anchor, oldImage, newImage]);

  if (!sample) return null;
  const isDiff = oldImage !== null && newImage !== null;
  return (
    <div className={styles.inspector}>
      <span className={styles.position}>
        {sample.x},{sample.y}
      </span>
      {isDiff ? (
        <>
          <Swatch rgba={sample.old} />
          <span className={styles.faint}>→</span>
          <Swatch rgba={sample.new} />
        </>
      ) : (
        <Swatch rgba={sample.new ?? sample.old} />
      )}
    </div>
  );
}

/** A revision's color at a pixel of the composed frame, or null where it doesn't cover it. */
function colorAt(image: DecodedImage | null, frame: Size, anchor: AnchorMode, pixel: { x: number; y: number }): Rgba | null {
  if (!image) return null;
  const offset = anchoredOffset(frame, image, anchor);
  const x = pixel.x - offset.x;
  const y = pixel.y - offset.y;
  if (x < 0 || x >= image.width || y < 0 || y >= image.height) return null;
  // Rasterized once per revision (the Differences mode usually has already): the one main-thread cost of a huge image.
  const { data, width } = rasterize(image);
  const at = (y * width + x) * 4;
  return [data[at]!, data[at + 1]!, data[at + 2]!, data[at + 3]!];
}

const SWATCH_CHECKER = 'repeating-conic-gradient(var(--bg-active) 0% 25%, transparent 0% 50%)';

function Swatch({ rgba }: { rgba: Rgba | null }) {
  if (!rgba) return <span className={styles.faint}>—</span>;
  const color = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3] / 255})`;
  return (
    <span className={styles.color}>
      <span
        className={styles.swatch}
        // The color is a gradient layer over the checkerboard: a background color would paint under it.
        style={{ backgroundImage: `linear-gradient(${color}, ${color}), ${SWATCH_CHECKER}` }}
      />
      {colorHex(rgba)}
    </span>
  );
}
