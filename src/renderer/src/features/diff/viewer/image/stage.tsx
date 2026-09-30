// Building blocks every image-diff mode composes: a Viewport (the pan/zoom
// event surface), a World (the transformed composed frame both revisions
// share) and an ImageLayer (one revision, placed in that frame by the active
// anchor — centered by default, the UVCS convention; top-left for canvas-grow
// comparisons). Keeping these tiny and shared is what lets all four modes
// feel like one viewer: same checkerboard, same transform, same physics.
// The floating chrome the modes share (pills, "Before / After" chips) lives
// here too, so every mode speaks with one visual voice.

import type { ReactNode } from 'react';
import { IconButton } from '../../../../ui/IconButton';
import { anchoredOffset, type AnchorMode, type Size } from './composedFrame';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';
import styles from './stage.module.css';

/** Marks viewport elements, so the pixel inspector can find the one under the cursor. */
export const VIEWPORT_ATTRIBUTE = 'data-image-viewport';

interface ViewportProps {
  panZoom: PanZoom;
  children: ReactNode;
}

/** The pan/zoom surface. Everything inside moves with the shared transform. */
export function Viewport({ panZoom, children }: ViewportProps) {
  return (
    <div className={styles.viewport} ref={panZoom.bindViewport} {...{ [VIEWPORT_ATTRIBUTE]: true }}>
      {children}
    </div>
  );
}

interface WorldProps {
  panZoom: PanZoom;
  frame: Size;
  children: ReactNode;
}

/** A CSS `inset(top right bottom left)` clip path; each edge clamps at 0. */
function clipInset(edges: { top: number; right: number; bottom: number; left: number }): string {
  const px = (n: number) => `${Math.max(0, n)}px`;
  return `inset(${px(edges.top)} ${px(edges.right)} ${px(edges.bottom)} ${px(edges.left)})`;
}

/**
 * The composed frame, placed by the shared transform. Scaling happens here
 * (one GPU-composited transform), so layers inside are laid out once in image
 * pixels and never reflow while zooming.
 *
 * The transparency checkerboard is an untransformed twin underneath: a
 * viewport-filling element painting constant 16px screen tiles, clipped to
 * the world's screen rect. Counter-scaling a background on the transformed
 * element reads simpler, but Chromium rasterizes the repeating gradient at
 * layout resolution — at deep zoom the fractional sub-pixel tiles alias away,
 * and the repeating conic visibly loses contrast with distance from its
 * origin. Sizing the twin to the *full* scaled world rect instead is what
 * blew up before: a 1125×750 image at 64× becomes a 72000×48000px element,
 * and rasterizing its gradient across that area exhausts Chromium's tile
 * memory (worse mid-glide, when width/height re-raster every frame). Keeping
 * it viewport-bounded and clipping to the world rect can't break at any zoom;
 * the pattern pans via background-position, and clip-path interpolates in
 * lockstep with the world's transform (both are linear in the same scale).
 */
export function World({ panZoom, frame, children }: WorldProps) {
  const { transform, viewport, animated } = panZoom;
  // Clip the viewport-filling backdrop down to the world's on-screen rect, so
  // the checker shows only behind the artwork. Each inset is the gap from a
  // viewport edge to the world rect, clamped at 0 (the world can run past
  // every edge at deep zoom). Until a viewport is measured, fill it — a
  // one-frame transient before the images decode.
  const clipPath = viewport
    ? clipInset({
        top: transform.y,
        left: transform.x,
        right: viewport.width - (transform.x + frame.width * transform.scale),
        bottom: viewport.height - (transform.y + frame.height * transform.scale),
      })
    : undefined;
  return (
    <>
      <div
        className={styles.checkerboard}
        data-gliding={animated || undefined}
        style={{
          // Screen-space pattern anchored to the world's top-left, so the
          // tiles pan with the image even though the element itself is fixed.
          backgroundPosition: `${transform.x}px ${transform.y}px`,
          clipPath,
        }}
      />
      <div
        className={styles.world}
        data-gliding={animated || undefined}
        // Pixelated upscaling from ~4× so pixel-peeping shows crisp texels
        // instead of smear; below that, smooth interpolation looks right.
        data-pixelated={transform.scale >= 4 || undefined}
        style={{
          width: frame.width,
          height: frame.height,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        {children}
      </div>
    </>
  );
}

interface ImageLayerProps {
  image: DecodedImage;
  frame: Size;
  /** Tints the revision border: before reads red, after reads green. */
  side: 'old' | 'new';
  /** How the revision is placed in the composed frame (only matters when the
   *  revisions differ in size). Defaults to centered. */
  anchor?: AnchorMode;
  /** 0–1 opacity for the onion-skin blend and the blink flip. */
  opacity?: number;
}

/** One revision, placed in the composed frame at its natural pixel size. */
export function ImageLayer({ image, frame, side, anchor = 'center', opacity }: ImageLayerProps) {
  const offset = anchoredOffset(frame, image, anchor);
  return (
    <img
      className={`${styles.layer} ${side === 'old' ? styles.layerOld : styles.layerNew}`}
      src={image.src}
      alt=""
      draggable={false}
      style={{ left: offset.x, top: offset.y, width: image.width, height: image.height, opacity }}
    />
  );
}

/** "Before / After" tag pinned to a pane corner (side by side, swipe). */
export function SideChip({ side, corner = 'left' }: { side: 'old' | 'new'; corner?: 'left' | 'right' }) {
  return (
    <span className={styles.sideChip} data-side={side} data-corner={corner}>
      {side === 'old' ? 'Before' : 'After'}
    </span>
  );
}

/**
 * A per-mode control strip floating at the top center: the onion blend, the
 * differences tolerance and region navigation. One shape, so the modes read
 * as one viewer. `row` stacks a second pill under the first.
 */
export function Pill({ children, row = 0, className }: { children: ReactNode; row?: 0 | 1; className?: string }) {
  return (
    <div className={`${styles.pill}${className ? ` ${className}` : ''}`} data-row={row}>
      {children}
    </div>
  );
}

export function PillLabel({ children, tip }: { children: ReactNode; tip?: string }) {
  return (
    <span className={styles.pillLabel} data-tip={tip}>
      {children}
    </span>
  );
}

export function PillValue({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={`${styles.pillValue}${className ? ` ${className}` : ''}`}>{children}</span>;
}

/** Buttons inside pills are quiet, small and round: a stock bordered button would dominate the strip. */
export function PillButton({ icon, label, onClick, prominent }: { icon: ReactNode; label: string; onClick: () => void; prominent?: boolean }) {
  return (
    <IconButton
      size="small"
      icon={icon}
      label={label}
      onClick={onClick}
      className={`${styles.pillButton}${prominent ? ` ${styles.pillButtonProminent}` : ''}`}
    />
  );
}
