// Pixel inspector: from 8× zoom, hovering reports the exact texel under the
// cursor — frame coordinates plus the before → after color, swatches included.
// Pixel forensics without an eyedropper round trip to an external editor.
// State lives here so the per-pixel pointermove never re-renders the viewer;
// the listener attaches to the stage element the viewer hands down.

import { type RefObject, useEffect, useRef, useState } from 'react';
import { type AnchorMode, anchoredOffset, type ViewTransform } from './imageDiff';
import { rasterize } from './rasterize';
import { VIEWPORT_ATTRIBUTE } from './stage';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';
import styles from './PixelInspector.module.css';

/** The inspector arms past this zoom — texels are ≥ 8 screen pixels, so the
 *  cursor can actually address one. */
const MIN_INSPECT_ZOOM = 8;

/** Controls layered over the stage: hovering them inspects nothing. */
const CONTROL_TARGETS = 'button, input, [data-no-pan]';

type Rgba = [number, number, number, number];

interface Sample {
  /** Composed-frame coordinates (matches what both revisions are laid out in). */
  x: number;
  y: number;
  /** null = that side doesn't cover this pixel (differently-sized revisions). */
  old: Rgba | null;
  new: Rgba | null;
}

interface PixelInspectorProps {
  oldImage: DecodedImage | null;
  newImage: DecodedImage | null;
  frame: { width: number; height: number };
  anchor: AnchorMode;
  panZoom: PanZoom;
  /** The stage element to listen on. */
  stageRef: RefObject<HTMLDivElement | null>;
}

function samplePixel(image: DecodedImage | null, frame: { width: number; height: number }, anchor: AnchorMode, fx: number, fy: number): Rgba | null {
  if (!image) return null;
  const offset = anchoredOffset(frame, image, anchor);
  const x = fx - offset.x;
  const y = fy - offset.y;
  if (x < 0 || x >= image.width || y < 0 || y >= image.height) return null;
  // Cached after the first call — the initial rasterize of a huge image is
  // the one main-thread hit, and the differences mode usually paid it already.
  const bitmap = rasterize(image);
  const i = (y * bitmap.width + x) * 4;
  return [bitmap.data[i]!, bitmap.data[i + 1]!, bitmap.data[i + 2]!, bitmap.data[i + 3]!];
}

export function PixelInspector({ oldImage, newImage, frame, anchor, panZoom, stageRef }: PixelInspectorProps) {
  const [sample, setSample] = useState<Sample | null>(null);
  // The pointermove handler reads the live transform through a ref so the
  // listener binds once, not on every pan frame.
  const transformRef = useRef<ViewTransform>(panZoom.transform);
  transformRef.current = panZoom.transform;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const clear = () => setSample(null);
    const onMove = (event: PointerEvent) => {
      const t = transformRef.current;
      const target = event.target as HTMLElement;
      const viewport = target.closest(`[${VIEWPORT_ATTRIBUTE}]`);
      if (t.scale < MIN_INSPECT_ZOOM || !viewport || target.closest(CONTROL_TARGETS)) {
        clear();
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const fx = Math.floor((event.clientX - rect.left - t.x) / t.scale);
      const fy = Math.floor((event.clientY - rect.top - t.y) / t.scale);
      if (fx < 0 || fx >= frame.width || fy < 0 || fy >= frame.height) {
        clear();
        return;
      }
      setSample({ x: fx, y: fy, old: samplePixel(oldImage, frame, anchor, fx, fy), new: samplePixel(newImage, frame, anchor, fx, fy) });
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', clear);
    return () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', clear);
      setSample(null);
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

/** #RRGGBB, with /AA appended only when the pixel isn't fully opaque. */
function hexOf([r, g, b, a]: Rgba): string {
  const hex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}${a !== 255 ? `/${hex(a)}` : ''}`;
}

const SWATCH_CHECKER = 'repeating-conic-gradient(var(--bg-active) 0% 25%, transparent 0% 50%)';

function Swatch({ rgba }: { rgba: Rgba | null }) {
  if (!rgba) return <span className={styles.faint}>—</span>;
  const color = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3] / 255})`;
  return (
    <span className={styles.color}>
      <span
        className={styles.swatch}
        // The color rides as a gradient layer over the checkerboard — a plain
        // background-color would paint *under* it.
        style={{ backgroundImage: `linear-gradient(${color}, ${color}), ${SWATCH_CHECKER}` }}
      />
      {hexOf(rgba)}
    </span>
  );
}
