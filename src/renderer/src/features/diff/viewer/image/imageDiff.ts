// Pure logic for the image diff viewer: perceptual pixel difference, heatmap
// compositing, changed-region detection and the pan/zoom geometry. No DOM
// here — everything operates on plain numbers and RGBA byte arrays so it can
// be unit-tested without a canvas, and so the heavy passes can run inside the
// Web Worker (see imageDiff.worker.ts) without duplication.

/** A decoded RGBA bitmap: tightly packed rows (stride = width * 4). The
 *  buffer is pinned to plain ArrayBuffer so it can feed `new ImageData()`. */
export interface RgbaBitmap {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/**
 * How two differently-sized revisions are aligned in the composed frame:
 * 'center' keeps resized assets visually anchored (the Unity UVCS
 * convention); 'top-left' matches how canvases usually grow (sprite sheets,
 * screenshots that gained a footer), so a grown image doesn't read as
 * "everything moved by half the delta".
 */
export type AnchorMode = 'center' | 'top-left';

/** The composed frame two differently-sized revisions are compared in. */
export function composedSize(
  a: { width: number; height: number },
  b: { width: number; height: number },
): { width: number; height: number } {
  return { width: Math.max(a.width, b.width), height: Math.max(a.height, b.height) };
}

/** Top-left offset that places `size` inside `frame` for the given anchor
 *  (centered offsets are floored to a whole pixel). */
export function anchoredOffset(
  frame: { width: number; height: number },
  size: { width: number; height: number },
  anchor: AnchorMode,
): { x: number; y: number } {
  if (anchor === 'top-left') return { x: 0, y: 0 };
  return {
    x: Math.floor((frame.width - size.width) / 2),
    y: Math.floor((frame.height - size.height) / 2),
  };
}

// ── Perceptual difference ────────────────────────────────────────────────────

/**
 * Everything the differences mode needs, computed in one pass and cached:
 * the per-pixel delta drives rendering, region detection and (through the
 * histogram) instant re-thresholding when the tolerance slider moves —
 * nothing here depends on the threshold, so sliding never re-compares pixels.
 */
export interface DiffData {
  width: number;
  height: number;
  /** Per-pixel perceptual difference, 0–255 (255 = covered by one side only).
   *  Pixels covered by neither side are 0. */
  delta: Uint8Array;
  /** The ghost backdrop: dimmed grayscale of the new image (old where only
   *  the old side covers), transparent where neither side covers. */
  underlay: Uint8ClampedArray<ArrayBuffer>;
  /** histogram[d] = covered pixels whose delta is exactly d. Pinned to plain
   *  ArrayBuffer so the worker can transfer it without a copy. */
  histogram: Uint32Array<ArrayBuffer>;
  /** Pixels covered by at least one image (the denominator for a % readout). */
  coveredPixels: number;
}

/** Composite one channel onto white by its alpha — differences are measured
 *  on what the eye can actually see, so an invisible color change under full
 *  transparency scores zero (the pixelmatch convention). */
const onWhite = (c: number, a: number): number => Math.round(255 + ((c - 255) * a) / 255);

/** Rec. 601 luma of an RGB triple, rounded to a byte. */
const luma = (r: number, g: number, b: number): number => Math.round(0.299 * r + 0.587 * g + 0.114 * b);

/**
 * Compare two bitmaps perceptually. Each pixel's delta is the largest channel
 * difference after compositing both sides onto white, plus the raw alpha
 * difference — so invisible changes (RGB drift under zero alpha) score 0,
 * while alpha-only changes (visible against the checkerboard) still register.
 * Unlike the bitwise ~(XOR) this replaced, the delta is monotonic in visual
 * change: 127→128 scores 1, 0→128 scores 128 — intensity means magnitude.
 */
export function computeDiff(old: RgbaBitmap, next: RgbaBitmap, anchor: AnchorMode): DiffData {
  const frame = composedSize(old, next);
  const n = frame.width * frame.height;
  const delta = new Uint8Array(n);
  const underlay = new Uint8ClampedArray(n * 4);
  const histogram = new Uint32Array(256);
  const oOff = anchoredOffset(frame, old, anchor);
  const nOff = anchoredOffset(frame, next, anchor);
  let coveredPixels = 0;

  for (let y = 0; y < frame.height; y++) {
    const oy = y - oOff.y;
    const ny = y - nOff.y;
    const oRow = oy >= 0 && oy < old.height;
    const nRow = ny >= 0 && ny < next.height;
    if (!oRow && !nRow) continue;
    for (let x = 0; x < frame.width; x++) {
      const ox = x - oOff.x;
      const nx = x - nOff.x;
      const inOld = oRow && ox >= 0 && ox < old.width;
      const inNew = nRow && nx >= 0 && nx < next.width;
      if (!inOld && !inNew) continue;
      coveredPixels++;
      const i = y * frame.width + x;

      let d: number;
      let gr = 0;
      let gg = 0;
      let gb = 0;
      let ga = 0;
      if (inOld && inNew) {
        const oi = (oy * old.width + ox) * 4;
        const ni = (ny * next.width + nx) * 4;
        const oa = old.data[oi + 3];
        const na = next.data[ni + 3];
        const dr = Math.abs(onWhite(old.data[oi], oa) - onWhite(next.data[ni], na));
        const dg = Math.abs(onWhite(old.data[oi + 1], oa) - onWhite(next.data[ni + 1], na));
        const db = Math.abs(onWhite(old.data[oi + 2], oa) - onWhite(next.data[ni + 2], na));
        d = Math.max(dr, dg, db, Math.abs(oa - na));
        gr = next.data[ni];
        gg = next.data[ni + 1];
        gb = next.data[ni + 2];
        ga = na;
      } else {
        // Covered by exactly one side: by definition a maximal change (the
        // pixel was added or removed outright).
        d = 255;
        const src = inNew ? next : old;
        const si = inNew ? (ny * next.width + nx) * 4 : (oy * old.width + ox) * 4;
        gr = src.data[si];
        gg = src.data[si + 1];
        gb = src.data[si + 2];
        ga = src.data[si + 3];
      }

      delta[i] = d;
      histogram[d]++;
      // Ghost underlay: luma of the pixel composited on white, at low alpha —
      // enough context to see *where in the image* a change sits, dim enough
      // that the accent overlay owns the attention.
      const l = luma(onWhite(gr, ga), onWhite(gg, ga), onWhite(gb, ga));
      const o = i * 4;
      underlay[o] = l;
      underlay[o + 1] = l;
      underlay[o + 2] = l;
      underlay[o + 3] = UNDERLAY_ALPHA;
    }
  }
  return { width: frame.width, height: frame.height, delta, underlay, histogram, coveredPixels };
}

/** Changed pixels at a tolerance: covered pixels whose delta exceeds it.
 *  O(256) thanks to the histogram — the slider can call this every frame. */
export function countAbove(histogram: Uint32Array, threshold: number): number {
  let count = 0;
  for (let d = threshold + 1; d < 256; d++) count += histogram[d];
  return count;
}

/** Tolerance slider range. 64 silences even heavy JPEG/AA noise; deltas from
 *  single-coverage pixels (255) stay above any tolerance by design. */
export const MAX_TOLERANCE = 64;

/** Heatmap accent (magenta): deliberately outside the red=old/green=new
 *  vocabulary the rest of the viewer uses, so "changed" reads as its own
 *  category, and equally loud on both themes. */
export const DIFF_ACCENT: readonly [number, number, number] = [236, 64, 142];

const UNDERLAY_ALPHA = 90;

/**
 * Render the heatmap frame for a tolerance: unchanged pixels show the ghost
 * underlay, changed pixels the accent with opacity proportional to the delta
 * — faint drift renders faint, real change renders solid. Pure remap of the
 * cached delta, so moving the slider never re-compares pixels.
 */
export function renderDiffFrame(diff: DiffData, threshold: number): Uint8ClampedArray<ArrayBuffer> {
  const { delta, underlay } = diff;
  const out = new Uint8ClampedArray(underlay.length);
  for (let i = 0; i < delta.length; i++) {
    const o = i * 4;
    const d = delta[i];
    if (d > threshold) {
      out[o] = DIFF_ACCENT[0];
      out[o + 1] = DIFF_ACCENT[1];
      out[o + 2] = DIFF_ACCENT[2];
      // 140–255: even a barely-over-tolerance pixel stays clearly visible.
      out[o + 3] = 140 + (((d * 115) / 255) | 0);
    } else {
      out[o] = underlay[o];
      out[o + 1] = underlay[o + 1];
      out[o + 2] = underlay[o + 2];
      out[o + 3] = underlay[o + 3];
    }
  }
  return out;
}

// ── Changed regions ──────────────────────────────────────────────────────────

/** An axis-aligned box around one cluster of changed pixels, frame coords. */
export interface ChangedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Changed pixels inside the box — lets callers sort by visual weight. */
  pixels: number;
}

export interface RegionOptions {
  /** Blobs closer than this (px) merge into one region. */
  mergeGap?: number;
  /** Hard cap on regions: the gap doubles until the count fits — dozens of
   *  stops would make next/prev navigation a chore, not a tool. */
  maxRegions?: number;
  /** Above this many raw blobs the change is noise (dithering, recompression)
   *  and per-region navigation is meaningless: collapse to one union box. */
  maxBlobs?: number;
}

/**
 * Cluster changed pixels (delta > threshold) into bounding boxes for
 * next/prev navigation, in reading order. Flood fill with an explicit stack
 * (8-connected), then nearby boxes merge so one logical edit split by a few
 * quiet pixels reads as one stop.
 */
export function findChangedRegions(
  delta: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  options: RegionOptions = {},
): ChangedRegion[] {
  const { mergeGap = 8, maxRegions = 32, maxBlobs = 1024 } = options;
  const visited = new Uint8Array(delta.length);
  const stack: number[] = [];
  let blobs: ChangedRegion[] = [];

  for (let i = 0; i < delta.length; i++) {
    if (visited[i] || delta[i] <= threshold) continue;
    let minX = i % width;
    let maxX = minX;
    let minY = (i / width) | 0;
    let maxY = minY;
    let pixels = 0;
    visited[i] = 1;
    stack.push(i);
    while (stack.length > 0) {
      const p = stack.pop() as number;
      const px = p % width;
      const py = (p / width) | 0;
      pixels++;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= width) continue;
          const q = ny * width + nx;
          if (!visited[q] && delta[q] > threshold) {
            visited[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    blobs.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixels });
    if (blobs.length > maxBlobs) {
      return [unionRegion(blobs, delta, threshold)];
    }
  }

  let gap = mergeGap;
  blobs = mergeRegions(blobs, gap);
  while (blobs.length > maxRegions) {
    gap *= 2;
    blobs = mergeRegions(blobs, gap);
  }
  return blobs.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * True when a region covers (almost) the whole frame — "jump to the change"
 * would just re-fit the view, so navigation shouldn't be offered for it. The
 * slack tolerates thin quiet borders around an otherwise global change.
 */
export function isWholeFrameRegion(region: ChangedRegion, frame: { width: number; height: number }, coverage = 0.9): boolean {
  return region.width >= frame.width * coverage && region.height >= frame.height * coverage;
}

/** One box around everything, with an exact changed-pixel count. */
function unionRegion(blobs: ChangedRegion[], delta: Uint8Array, threshold: number): ChangedRegion {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let maxY = 0;
  for (const b of blobs) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  // The flood fill stopped early, so blob counts are partial — recount.
  let pixels = 0;
  for (let i = 0; i < delta.length; i++) if (delta[i] > threshold) pixels++;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY, pixels };
}

/** Merge boxes whose bounds, expanded by `gap`, intersect — to a fixpoint. */
function mergeRegions(regions: ChangedRegion[], gap: number): ChangedRegion[] {
  const out = [...regions];
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (a.x - gap < b.x + b.width && b.x - gap < a.x + a.width && a.y - gap < b.y + b.height && b.y - gap < a.y + a.height) {
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          out[i] = {
            x,
            y,
            width: Math.max(a.x + a.width, b.x + b.width) - x,
            height: Math.max(a.y + a.height, b.y + b.height) - y,
            pixels: a.pixels + b.pixels,
          };
          out.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return out;
}

// ── Pan/zoom geometry ────────────────────────────────────────────────────────

/** Zoom bounds: deep enough for pixel forensics, shallow enough to find tiny
 *  thumbnails again. */
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 64;

/** Multiplier for the zoom in/out buttons and keyboard shortcuts. */
export const ZOOM_STEP = 1.5;

/** Region navigation never zooms past this: a 2-pixel nick should fill a
 *  comfortable chunk of the pane, not a wall of four texels. */
export const REGION_MAX_ZOOM = 16;

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/**
 * The scale that fits `image` inside `frame` with a small breathing margin,
 * never upscaling past 100% — a 16×16 icon blown up to fill the pane reads as
 * a bug, not a fit.
 */
export function fitZoom(frame: { width: number; height: number }, image: { width: number; height: number }, margin = 24): number {
  if (image.width <= 0 || image.height <= 0) return 1;
  const availW = Math.max(frame.width - margin * 2, 1);
  const availH = Math.max(frame.height - margin * 2, 1);
  return clampZoom(Math.min(availW / image.width, availH / image.height, 1));
}

export interface ViewTransform {
  scale: number;
  /** Translation of the image's top-left corner, in viewport pixels. */
  x: number;
  y: number;
}

/**
 * Clamp a pan so the image can never be lost: axes where the scaled image
 * fits inside the viewport stay centered; larger axes can pan exactly to
 * their edges and no further.
 */
export function clampPan(
  t: ViewTransform,
  frame: { width: number; height: number },
  image: { width: number; height: number },
): ViewTransform {
  const w = image.width * t.scale;
  const h = image.height * t.scale;
  const x = w <= frame.width ? (frame.width - w) / 2 : Math.min(0, Math.max(frame.width - w, t.x));
  const y = h <= frame.height ? (frame.height - h) / 2 : Math.min(0, Math.max(frame.height - h, t.y));
  return { scale: t.scale, x, y };
}

/** The transform that shows the image at `scale`, centered in the viewport. */
export function centeredTransform(
  scale: number,
  frame: { width: number; height: number },
  image: { width: number; height: number },
): ViewTransform {
  return {
    scale,
    x: (frame.width - image.width * scale) / 2,
    y: (frame.height - image.height * scale) / 2,
  };
}

/**
 * The transform that centers `rect` (image coords) in the viewport, zoomed to
 * fill it with a margin — unlike fitZoom this happily upscales (that's the
 * point of jumping to a small changed region), capped at `maxScale`.
 */
export function rectTransform(
  frame: { width: number; height: number },
  rect: { x: number; y: number; width: number; height: number },
  maxScale = REGION_MAX_ZOOM,
  margin = 48,
): ViewTransform {
  const availW = Math.max(frame.width - margin * 2, 1);
  const availH = Math.max(frame.height - margin * 2, 1);
  const scale = clampZoom(Math.min(availW / Math.max(rect.width, 1), availH / Math.max(rect.height, 1), maxScale));
  return {
    scale,
    x: frame.width / 2 - (rect.x + rect.width / 2) * scale,
    y: frame.height / 2 - (rect.y + rect.height / 2) * scale,
  };
}

/**
 * Rescale around a viewport anchor point (the cursor): the image pixel under
 * the anchor stays under it, which is what makes wheel/pinch zoom feel
 * physical instead of teleporting.
 */
export function zoomAroundPoint(
  t: ViewTransform,
  nextScale: number,
  anchor: { x: number; y: number },
  frame: { width: number; height: number },
  image: { width: number; height: number },
): ViewTransform {
  const scale = clampZoom(nextScale);
  const ratio = scale / t.scale;
  return clampPan({ scale, x: anchor.x - (anchor.x - t.x) * ratio, y: anchor.y - (anchor.y - t.y) * ratio }, frame, image);
}

/** Human zoom label: 100%, 33%, 6.3%, 1600%. */
export function zoomLabel(scale: number): string {
  const pct = scale * 100;
  return `${pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%`;
}
