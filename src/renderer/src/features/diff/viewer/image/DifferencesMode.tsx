// Differences: a heatmap. Unchanged pixels show a dim gray ghost of the image (so a change is seen where it is in the
// picture), changed ones the accent, as opaque as they changed. The tolerance slider renders it again from the pair
// kept, never comparing pixels again, and ‹ › step through the changed regions. The pixel passes run in a worker
// (`useHeatmap`, `imageDiffSession`); this component only draws.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSpinDelay } from '../../../../lib/useSpinDelay';
import { Spinner } from '../../../../ui/Spinner';
import { regionCounter, steppableRegions, steppedRegion } from './changedRegions';
import type { AnchorMode, Size } from './composedFrame';
import type { DiffStats } from './imageInfo';
import { countChangedPixels, MAX_TOLERANCE } from './pixelComparison';
import { Pill, PillButton, PillLabel, PillValue, Viewport, World } from './stage';
import type { DecodedImage } from './useDecodedImage';
import { useHeatmap, type CachedHeatmap } from './useHeatmap';
import type { PanZoom } from './usePanZoom';
import styles from './DifferencesMode.module.css';

interface DifferencesModeProps {
  oldImage: DecodedImage;
  newImage: DecodedImage;
  frame: Size;
  panZoom: PanZoom;
  anchor: AnchorMode;
  /** How much a pixel may change and still count as unchanged (0 to `MAX_TOLERANCE`). */
  tolerance: number;
  onToleranceChange: (tolerance: number) => void;
  /** The viewer's heatmap of the pair, kept across mode switches. */
  cache: { current: CachedHeatmap | null };
  onStats: (stats: DiffStats) => void;
}

export function DifferencesMode({ oldImage, newImage, frame, panZoom, anchor, tolerance, onToleranceChange, cache, onStats }: DifferencesModeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { heatmap, comparing } = useHeatmap({ oldImage, newImage, anchor, tolerance, cache });
  // The region stepped to, on the heatmap it was stepped on: a heatmap rendered anew starts over.
  const [stepped, setStepped] = useState<{ heatmap: CachedHeatmap; index: number } | null>(null);
  const current = stepped && stepped.heatmap === heatmap ? stepped.index : null;
  // A spinner only for a slow comparison (a pair of several megapixels): a small pair compares in a frame or two.
  const spin = useSpinDelay(comparing);

  // The share of changed pixels follows the slider at once, counted from the histogram.
  useEffect(() => {
    if (heatmap) onStats({ changedPixels: countChangedPixels(heatmap.histogram, tolerance), coveredPixels: heatmap.coveredPixels });
  }, [heatmap, tolerance, onStats]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heatmap) return;
    canvas.width = heatmap.imageData.width;
    canvas.height = heatmap.imageData.height;
    canvas.getContext('2d')?.putImageData(heatmap.imageData, 0, 0);
  }, [heatmap]);

  // The slider only shows where it can change something: when no pixel's difference is within its range (sharp edits,
  // added or removed areas score 0 or 255), every position looks the same. Shown while comparing.
  const toleranceMatters = heatmap ? countChangedPixels(heatmap.histogram, 0) !== countChangedPixels(heatmap.histogram, MAX_TOLERANCE) : true;
  const regions = heatmap ? steppableRegions(heatmap.regions, frame) : [];
  const region = current === null ? undefined : regions[current];

  const step = (direction: 1 | -1): void => {
    if (!heatmap || regions.length === 0) return;
    const index = steppedRegion(current, direction, regions.length);
    setStepped({ heatmap, index });
    panZoom.zoomToRect(regions[index]!);
  };

  return (
    <Viewport panZoom={panZoom}>
      <World panZoom={panZoom} frame={frame}>
        <canvas ref={canvasRef} className={styles.canvas} />
        {region && (
          <div
            className={styles.regionFocus}
            style={{
              left: region.x,
              top: region.y,
              width: region.width,
              height: region.height,
              // The world's scale scales the border too: divided by it, the ring stays about 2 screen pixels.
              borderWidth: Math.max(2 / panZoom.transform.scale, 0.2),
            }}
          />
        )}
      </World>
      {/* Two pills: the tolerance keeps one shape (its value holds three digits), and the regions come and go in their
          own below it as the slider changes what counts, so nothing moves under the pointer mid-drag. */}
      {toleranceMatters && (
        <Pill>
          {/* The tooltip hangs off the label: under the slider it would cover the regions' pill while both are in use. */}
          <PillLabel tip="Ignore pixel drift up to this much (compression noise, anti-aliasing)">Tolerance</PillLabel>
          <input
            className={styles.toleranceSlider}
            type="range"
            min={0}
            max={MAX_TOLERANCE}
            step={1}
            value={tolerance}
            aria-label="Difference tolerance"
            onChange={(event) => onToleranceChange(Number(event.target.value))}
          />
          <PillValue className={styles.toleranceReadout}>{tolerance}</PillValue>
        </Pill>
      )}
      {regions.length > 0 && (
        <Pill row={toleranceMatters ? 1 : 0} className={styles.regionNav}>
          {/* Both arrows even for one region (each zooms to it): the pill keeps one shape however many there are. */}
          <PillButton icon={<ChevronLeft size={14} />} label="Previous changed region" onClick={() => step(-1)} />
          <PillValue className={styles.regionCount}>{regionCounter(regions.length, current)}</PillValue>
          <PillButton icon={<ChevronRight size={14} />} label="Next changed region" onClick={() => step(1)} />
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
