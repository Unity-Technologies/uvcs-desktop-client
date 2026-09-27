// Differences: a perceptual heatmap. Unchanged pixels show a dimmed grayscale
// ghost of the image (so a change is located *in* the picture, not on a blank
// field); changed pixels glow in the accent, opacity proportional to how much
// they changed. A tolerance slider re-thresholds the cached per-pixel delta —
// sliding never re-compares pixels — and changed pixels cluster into regions
// the ‹ › buttons jump between. The pixel passes run in a Web Worker (see
// imageDiff.worker.ts); this component only orchestrates and draws.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSpinDelay } from '../../../../lib/useSpinDelay';
import { Spinner } from '../../../../ui/Spinner';
import { type AnchorMode, countAbove, isWholeFrameRegion, MAX_TOLERANCE } from './imageDiff';
import { compositionKey } from './compositionKey';
import { computeImageDiff, type DiffComputation, rethresholdImageDiff } from './imageDiffSession';
import { rasterize } from './rasterize';
import { Pill, PillButton, PillLabel, PillValue, Viewport, World } from './stage';
import type { DecodedImage } from './useDecodedImage';
import type { PanZoom } from './usePanZoom';
import styles from './DifferencesMode.module.css';

export interface DiffStats {
  changedPixels: number;
  coveredPixels: number;
}

/** A computed heatmap, cached by the viewer across mode switches. */
export interface DiffComposition extends DiffComputation {
  /** Identity of the pair + anchor this was computed for. */
  key: string;
  /** The tolerance the frame and regions were rendered at. */
  threshold: number;
}

interface DifferencesModeProps {
  oldImage: DecodedImage;
  newImage: DecodedImage;
  frame: { width: number; height: number };
  panZoom: PanZoom;
  anchor: AnchorMode;
  /** Tolerance below which a pixel's delta counts as unchanged (0–MAX_TOLERANCE). */
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  /** Single-entry cache owned by the viewer (survives mode round-trips). */
  cache: { current: DiffComposition | null };
  onStats: (stats: DiffStats) => void;
}

export function DifferencesMode({ oldImage, newImage, frame, panZoom, anchor, threshold, onThresholdChange, cache, onStats }: DifferencesModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [composition, setComposition] = useState<DiffComposition | null>(null);
  const [computing, setComputing] = useState(false);
  /** Index into composition.regions; −1 until the user navigates. */
  const [activeRegion, setActiveRegion] = useState(-1);
  // Spinner only for genuinely slow compositions (multi-megapixel pairs) —
  // small images compose in a frame or two and must not flash.
  const spin = useSpinDelay(computing);
  // The compute effect reads the tolerance through a ref so slider moves
  // don't restart a full computation — rethresholding owns those.
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;

  const key = compositionKey(oldImage, newImage, anchor);

  // Full computation: new pair or anchor flip.
  useEffect(() => {
    let stale = false;
    const adopt = (next: DiffComposition) => {
      if (stale) return;
      cache.current = next;
      setComposition(next);
      setActiveRegion(-1);
      setComputing(false);
    };
    const cached = cache.current;
    if (cached && cached.key === key) {
      adopt(cached);
      return;
    }
    setComputing(true);
    // Yield a frame so the mode switch paints before rasterization (the one
    // main-thread step — the canvas API needs the DOM) and the worker round
    // trip; the UI never appears to hang.
    const raf = requestAnimationFrame(async () => {
      const at = thresholdRef.current;
      adopt({ key, threshold: at, ...(await computeImageDiff(key, rasterize(oldImage), rasterize(newImage), anchor, at)) });
    });
    return () => {
      stale = true;
      cancelAnimationFrame(raf);
    };
  }, [key, oldImage, newImage, anchor, cache]);

  // Tolerance moved: re-render from the cached delta (debounced — the slider
  // streams values; the stats react instantly via the histogram).
  useEffect(() => {
    if (!composition || composition.key !== key || composition.threshold === threshold) return;
    let stale = false;
    const adopt = (next: DiffComposition) => {
      cache.current = next;
      setComposition(next);
      setActiveRegion(-1);
    };
    const timer = setTimeout(async () => {
      const rendered = await rethresholdImageDiff(key, threshold);
      if (stale) return;
      if (rendered) {
        adopt({ ...composition, ...rendered, threshold });
        return;
      }
      // The worker lost this pair (restarted after a crash): full recompute.
      setComputing(true);
      const result = await computeImageDiff(key, rasterize(oldImage), rasterize(newImage), anchor, threshold);
      if (stale) return;
      adopt({ key, threshold, ...result });
      setComputing(false);
    }, 60);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [composition, key, threshold, oldImage, newImage, anchor, cache]);

  // Stats react to the slider instantly: an O(256) histogram sum, no worker.
  useEffect(() => {
    if (!composition || composition.key !== key) return;
    onStats({ changedPixels: countAbove(composition.histogram, threshold), coveredPixels: composition.coveredPixels });
  }, [composition, key, threshold, onStats]);

  // Paint the frame whenever a new one lands.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !composition) return;
    canvas.width = composition.imageData.width;
    canvas.height = composition.imageData.height;
    canvas.getContext('2d')?.putImageData(composition.imageData, 0, 0);
  }, [composition]);

  // The tolerance slider earns its place only when it can change anything:
  // when no covered pixel's delta falls inside the slider's range (sharp
  // edits and added/removed areas score only 0 or 255), every position
  // renders identically — hide the pill instead of offering a dead control.
  // O(1) thanks to the histogram; defaults to visible while computing.
  const current = composition && composition.key === key ? composition : null;
  const toleranceMatters = current ? countAbove(current.histogram, 0) !== countAbove(current.histogram, MAX_TOLERANCE) : true;

  const allRegions = current ? current.regions : [];
  // A lone region spanning ~the whole picture is not a destination — jumping
  // to it would just re-fit the view — so it gets no navigation.
  const wholeImage = allRegions.length === 1 && isWholeFrameRegion(allRegions[0]!, frame);
  const regions = wholeImage ? [] : allRegions;
  const active = activeRegion >= 0 ? regions[activeRegion] : undefined;

  const stepRegion = (direction: 1 | -1) => {
    if (regions.length === 0) return;
    const next =
      activeRegion < 0 ? (direction > 0 ? 0 : regions.length - 1) : (activeRegion + direction + regions.length) % regions.length;
    setActiveRegion(next);
    panZoom.zoomToRect(regions[next]!);
  };

  return (
    <Viewport panZoom={panZoom}>
      <World panZoom={panZoom} frame={frame}>
        <canvas ref={canvasRef} className={styles.canvas} />
        {active && (
          <div
            className={styles.regionFocus}
            style={{
              left: active.x,
              top: active.y,
              width: active.width,
              height: active.height,
              // The world transform scales borders too: counter-scale so the
              // focus ring stays ~2 screen pixels at any zoom.
              borderWidth: Math.max(2 / panZoom.transform.scale, 0.2),
            }}
          />
        )}
      </World>
      {/* Two stacked pills: the tolerance pill has one fixed geometry (the
          value slot reserves three digits), and region navigation lives in
          its own pill underneath, free to appear and disappear as the slider
          changes what counts as a region — nothing ever moves under the
          cursor mid-drag. */}
      {toleranceMatters && (
        <Pill>
          {/* The explainer tooltip hangs off the label, not the slider — under
              the slider it would cover the region pill exactly while both are
              in use. */}
          <PillLabel tip="Ignore pixel drift up to this much (compression noise, anti-aliasing)">Tolerance</PillLabel>
          <input
            className={styles.toleranceSlider}
            type="range"
            min={0}
            max={MAX_TOLERANCE}
            step={1}
            value={threshold}
            aria-label="Difference tolerance"
            onChange={(event) => onThresholdChange(Number(event.target.value))}
          />
          <PillValue className={styles.toleranceReadout}>{threshold}</PillValue>
        </Pill>
      )}
      {regions.length > 0 && (
        <Pill row={toleranceMatters ? 1 : 0} className={styles.regionNav}>
          {/* Both arrows render even for a single region (each just zooms to
              it) — the pill keeps one symmetric shape however many there are. */}
          <PillButton icon={<ChevronLeft size={14} />} label="Previous changed region" onClick={() => stepRegion(-1)} />
          <PillValue className={styles.regionCount}>{regionCounter(regions.length, activeRegion)}</PillValue>
          <PillButton icon={<ChevronRight size={14} />} label="Next changed region" onClick={() => stepRegion(1)} />
        </Pill>
      )}
      {spin && (
        <div className={styles.computing}>
          <Spinner size={14} /> Comparing pixels…
        </div>
      )}
    </Viewport>
  );
}

/** "3 regions" before navigating, "2 of 3" while stepping, "1 region" as the
 *  label for the lone zoom-to-it button. */
function regionCounter(count: number, activeRegion: number): string {
  if (count === 1) return '1 region';
  return activeRegion < 0 ? `${count} regions` : `${activeRegion + 1} of ${count}`;
}
