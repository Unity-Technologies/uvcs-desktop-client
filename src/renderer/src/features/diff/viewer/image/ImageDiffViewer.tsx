// The image pane: a single preview for added/deleted images, and a four-mode
// visual diff (onion skin — with its blink autoplay — / side by side /
// differences / swipe) for modified ones. The mode control lives in the diff
// header (`LoadedFileDiff` renders it where text diffs show
// Split/Unified — one place for "how do I view this diff" across the app).
// One shared pan/zoom drives every mode, so switching modes keeps the
// framing; zoom controls float over the stage (joined by the anchor toggle
// when the revisions differ in size); an info strip narrates the change
// (dimensions, sizes, % of pixels that differ) and a pixel inspector reports
// exact texels from 8× zoom.

import { ImageOff } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { FileContent } from '@shared/domain/content';
import { useSpinDelay } from '../../../../lib/useSpinDelay';
import { EmptyState } from '../../../../ui/EmptyState';
import { CenteredSpinner } from '../../../../ui/Spinner';
import { useDiffPreferences } from '../diffPreferencesStore';
import { DifferencesMode } from './DifferencesMode';
import { composedSize } from './composedFrame';
import type { ImageDiffMode } from './imageDiffModes';
import type { DiffStats } from './imageInfo';
import { ImageInfoStrip } from './ImageInfoStrip';
import { OnionSkinMode } from './OnionSkinMode';
import { PixelInspector } from './PixelInspector';
import { MAX_TOLERANCE } from './pixelComparison';
import { SideBySideMode } from './SideBySideMode';
import { ImageLayer, Viewport, World } from './stage';
import { SwipeMode } from './SwipeMode';
import { useDecodedImage } from './useDecodedImage';
import type { CachedHeatmap } from './useHeatmap';
import { usePanZoom } from './usePanZoom';
import { ZoomControls } from './ZoomControls';
import { zoomCommandOf } from './zoomKeys';
import styles from './ImageDiffViewer.module.css';

interface ImageDiffViewerProps {
  original: FileContent;
  modified: FileContent;
  /** Active diff mode; owned by the header's segmented control. */
  mode: ImageDiffMode;
}

/** Mount one per pair of images: blend, stats and the heatmap cache belong to the pair. */
export function ImageDiffViewer({ original, modified, mode }: ImageDiffViewerProps) {
  const oldState = useDecodedImage(original.image);
  const newState = useDecodedImage(modified.image);
  const { imageAnchor: anchor, imageTolerance, setImageAnchor, setImageTolerance } = useDiffPreferences();
  const tolerance = Math.min(MAX_TOLERANCE, Math.max(0, Math.round(imageTolerance)));
  // Onion blend lives here (not in the mode) so a trip through other modes
  // comes back to the same mix.
  const [blend, setBlend] = useState(0.5);
  const [stats, setStats] = useState<DiffStats | null>(null);
  const heatmapCache = useRef<CachedHeatmap | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const oldImage = oldState.status === 'ready' ? oldState.image : null;
  const newImage = newState.status === 'ready' ? newState.image : null;
  const isDiff = Boolean(original.image && modified.image);
  const sizesDiffer = !!oldImage && !!newImage && (oldImage.width !== newImage.width || oldImage.height !== newImage.height);

  // The composed frame both revisions are laid out in (max of both sizes).
  const frame = useMemo(() => {
    if (oldImage && newImage) return composedSize(oldImage, newImage);
    const single = newImage ?? oldImage;
    return single ? { width: single.width, height: single.height } : null;
  }, [oldImage, newImage]);

  const panZoom = usePanZoom(frame);
  const decoding = !frame || (isDiff && (!oldImage || !newImage));
  const spin = useSpinDelay(decoding);

  // Keyboard zoom on the focused stage (`zoomCommandOf`).
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const command = zoomCommandOf(event.nativeEvent);
      if (!command) return;
      event.preventDefault();
      panZoom[command]();
    },
    [panZoom],
  );

  if (oldState.status === 'error' || newState.status === 'error') {
    return <EmptyState icon={<ImageOff size={22} />} title="Couldn't display this image" description="The file looks like an image but couldn't be decoded." />;
  }
  if (decoding || !frame) return spin ? <CenteredSpinner /> : null;

  return (
    <div className={styles.pane} tabIndex={0} onKeyDown={onKeyDown}>
      <div className={styles.stage} ref={stageRef}>
        {!isDiff && (
          <Viewport panZoom={panZoom}>
            <World panZoom={panZoom} frame={frame}>
              {oldImage && <ImageLayer image={oldImage} frame={frame} side="old" />}
              {newImage && <ImageLayer image={newImage} frame={frame} side="new" />}
            </World>
          </Viewport>
        )}
        {isDiff && oldImage && newImage && (
          <>
            {mode === 'onion' && (
              <OnionSkinMode oldImage={oldImage} newImage={newImage} frame={frame} panZoom={panZoom} anchor={anchor} blend={blend} onBlendChange={setBlend} />
            )}
            {mode === 'sideBySide' && <SideBySideMode oldImage={oldImage} newImage={newImage} frame={frame} panZoom={panZoom} anchor={anchor} />}
            {mode === 'differences' && (
              <DifferencesMode
                oldImage={oldImage}
                newImage={newImage}
                frame={frame}
                panZoom={panZoom}
                anchor={anchor}
                tolerance={tolerance}
                onToleranceChange={setImageTolerance}
                cache={heatmapCache}
                onStats={setStats}
              />
            )}
            {mode === 'swipe' && <SwipeMode oldImage={oldImage} newImage={newImage} frame={frame} panZoom={panZoom} anchor={anchor} />}
          </>
        )}

        {/* Resized image: the anchor toggle asks how the two sizes align. Hidden when sizes match — it would do nothing. */}
        <ZoomControls panZoom={panZoom} anchor={isDiff && sizesDiffer ? anchor : null} onAnchorChange={setImageAnchor} />
        <PixelInspector oldImage={oldImage} newImage={newImage} frame={frame} anchor={anchor} panZoom={panZoom} stageRef={stageRef} />
        <ImageInfoStrip
          old={oldImage && { image: oldImage, bytes: original.size }}
          new={newImage && { image: newImage, bytes: modified.size }}
          stats={mode === 'differences' && isDiff ? stats : null}
          tolerance={tolerance}
        />
      </div>
    </div>
  );
}
