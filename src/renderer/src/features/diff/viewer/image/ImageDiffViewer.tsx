// The image pane: a single preview for added/deleted images, and a four-mode
// visual diff (onion skin — with its blink autoplay — / side by side /
// differences / swipe) for modified ones. The mode control lives in the diff
// header (`LoadedFileDiff` renders it where text diffs show
// Split/Unified — one place for "how do I view this diff" across the app).
// One shared pan/zoom drives every mode, so switching modes keeps the
// framing; zoom controls float over the stage (joined by the anchor toggle
// when the revisions differ in size); an info strip narrates the change
// (dimensions, sizes, % of pixels that differ) and a pixel inspector reports
// exact texels from 8× zoom (of a high dynamic range image, the texels as
// shown). Unity's texture formats (TGA, TIFF, PSD, EXR, HDR) are decoded in a
// worker first (`usePaintableImage`); a side that can't be shows the binary
// diff, saying why.

import { ImageOff } from 'lucide-react';
import { useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { keyTakenByText } from '../../../../lib/textEntry';
import type { FileContent } from '@shared/domain/content';
import { useSpinDelay } from '../../../../lib/useSpinDelay';
import { EmptyState } from '../../../../ui/EmptyState';
import { CenteredSpinner } from '../../../../ui/Spinner';
import { DiffNotice } from '../DiffNotice';
import { useDiffPreferences } from '../diffPreferencesStore';
import { sizeChange, TOO_LARGE_TITLES } from '../fileSizeWords';
import { OpenFileButton } from '../OpenFileButton';
import { DifferencesMode } from './DifferencesMode';
import { composedSize } from './composedFrame';
import type { ImageDiffMode } from './imageDiffModes';
import { forgetComparedImages } from './imageDiffSession';
import { undecodedDescription, unpaintedNotice, type DiffStats } from './imageInfo';
import { imagePairView } from './imagePairView';
import { ImageInfoStrip } from './ImageInfoStrip';
import { OnionSkinMode } from './OnionSkinMode';
import { PixelInspector } from './PixelInspector';
import { MAX_TOLERANCE } from './pixelComparison';
import { SideBySideMode } from './SideBySideMode';
import { BOTH_SIDES, ImageLayer, Viewport, World } from './stage';
import { SwipeMode } from './SwipeMode';
import { useDecodedImage, type DecodedImage } from './useDecodedImage';
import type { CachedHeatmap } from './useHeatmap';
import { usePanZoom } from './usePanZoom';
import { ZoomControls } from './ZoomControls';
import { stageCommandOf } from './zoomKeys';
import { commentKeyAction, type CommentKeyAction } from '../pins/stageCommenting';
import { useLeaveCommentCommand } from '../pins/useLeaveCommentCommand';
import { ImageAnnotationsContext, takesComments, type ImageSide } from './imageAnnotations';
import { ImageCommentsOverlay } from './ImageCommentsOverlay';
import { revealedRect, spotInFrame } from './imageSpotGeometry';
import { anchoredOffset } from './composedFrame';
import type { StageOverlay } from './stage';
import styles from './ImageDiffViewer.module.css';

interface ImageDiffViewerProps {
  original: FileContent;
  modified: FileContent;
  /** Active diff mode; owned by the header's segmented control. */
  mode: ImageDiffMode;
  /** Opens a workspace file in the app it opens with, offered where no version can be painted for its size. */
  openFile?: () => void;
}

/** Mount one per pair of images: blend, stats and the heatmap cache belong to the pair. */
export function ImageDiffViewer({ original, modified, mode, openFile }: ImageDiffViewerProps) {
  const oldState = useDecodedImage(original.image);
  const newState = useDecodedImage(modified.image);
  const { imageAnchor: anchor, imageTolerance, setImageAnchor, setImageTolerance } = useDiffPreferences();
  const tolerance = Math.min(MAX_TOLERANCE, Math.max(0, Math.round(imageTolerance)));
  // Onion blend lives here (not in the mode) so a trip through other modes
  // comes back to the same mix.
  const [blend, setBlend] = useState(0.5);
  const [stats, setStats] = useState<DiffStats | null>(null);
  const heatmapCache = useRef<CachedHeatmap | null>(null);
  // The pair compared for Differences stays in the worker for the next tolerance, as long as this viewer shows it.
  useEffect(() => forgetComparedImages, []);
  const stageRef = useRef<HTMLDivElement>(null);

  const view = imagePairView(oldState, newState);
  const oldImage = view.kind === 'painted' ? view.old : null;
  const newImage = view.kind === 'painted' ? view.new : null;
  const isDiff = Boolean(oldImage && newImage);
  const sizesDiffer = !!oldImage && !!newImage && (oldImage.width !== newImage.width || oldImage.height !== newImage.height);

  // The composed frame both revisions are laid out in (max of both sizes).
  const frame = useMemo(() => {
    if (oldImage && newImage) return composedSize(oldImage, newImage);
    const single = newImage ?? oldImage;
    return single ? { width: single.width, height: single.height } : null;
  }, [oldImage, newImage]);

  const panZoom = usePanZoom(frame);
  const decoding = view.kind === 'loading';
  const spin = useSpinDelay(decoding);

  // A review's comments on the image (`ImageAnnotationsContext`): its pins, and marking a new one's spot.
  const annotations = useContext(ImageAnnotationsContext);
  const shownImages = { old: oldImage, new: newImage };
  const commentable = takesComments(annotations, shownImages);
  const [commenting, setCommenting] = useState(false);
  const isCommenting = commenting && commentable;

  // A pin gone to (from the Comments panel, the conversation) comes into view, at the zoom shown.
  const revealSeq = annotations?.reveal?.seq;
  useEffect(() => {
    const pin = annotations?.pins.find((candidate) => candidate.key === annotations.reveal?.key);
    const image = pin && shownImages[pin.side];
    if (!pin || !image || !frame) return;
    const rect = spotInFrame(pin.spot, anchoredOffset(frame, image, anchor));
    panZoom.showRect(panZoom.viewport ? revealedRect(rect, panZoom.viewport, panZoom.transform.scale) : rect);
  }, [revealSeq, frame]);

  const stageCommenting = { commenting: isCommenting, commentable, opened: annotations?.opened != null };
  const applyCommentAction = (action: NonNullable<CommentKeyAction>): void => {
    if (action === 'closeCard') annotations?.onOpen(null);
    else setCommenting(action === 'startCommenting');
  };
  // Esc wherever else the keyboard is in the diff (the Comments panel a comment was gone to from).
  useLeaveCommentCommand('imageCommentLeave', stageCommenting, applyCommentAction);

  // The stage's keys while it has the focus (`stageCommandOf`, `commentKeyAction`); none typed in a comment's card
  // over it.
  const onKeyDown = (event: KeyboardEvent) => {
    if (keyTakenByText(event.nativeEvent)) return;
    const command = stageCommandOf(event.nativeEvent);
    if (!command) return;
    if (command === 'comment' || command === 'leaveComment') {
      const action = commentKeyAction(command, stageCommenting);
      if (!action) return;
      event.preventDefault();
      applyCommentAction(action);
      return;
    }
    event.preventDefault();
    panZoom[command]();
  };

  // No version paints: too large reads as any image too large to preview; otherwise the binary diff, saying why.
  if (view.kind === 'unpainted') {
    if (view.problem === 'tooLarge') {
      return <EmptyState title={TOO_LARGE_TITLES.image} description={sizeChange(original, modified)} action={openFile && <OpenFileButton onClick={openFile} />} />;
    }
    return <EmptyState title="Binary file" description={undecodedDescription(original, modified, view.problem)} />;
  }
  if (decoding || !frame) return spin ? <CenteredSpinner /> : null;

  const overlay: StageOverlay | undefined =
    annotations === null
      ? undefined
      : (sides) => (
          <ImageCommentsOverlay
            annotations={annotations}
            panZoom={panZoom}
            frame={frame}
            anchor={isDiff ? anchor : 'center'}
            images={imagesOn(sides, shownImages)}
            commenting={isCommenting && annotations.commentsOn !== null && sides.includes(annotations.commentsOn)}
            onCommented={() => setCommenting(false)}
          />
        );

  return (
    <div className={styles.pane} tabIndex={0} onKeyDown={onKeyDown}>
      {view.kind === 'painted' && view.unpainted && (
        <DiffNotice tone="info" icon={<ImageOff size={13} />}>
          {unpaintedNotice(view.unpainted.side, view.unpainted.problem)}
        </DiffNotice>
      )}
      <div className={styles.stage} ref={stageRef}>
        {!isDiff && (
          <Viewport panZoom={panZoom}>
            <World panZoom={panZoom} frame={frame}>
              {oldImage && <ImageLayer image={oldImage} frame={frame} side="old" />}
              {newImage && <ImageLayer image={newImage} frame={frame} side="new" />}
            </World>
            {overlay?.(BOTH_SIDES)}
          </Viewport>
        )}
        {isDiff && oldImage && newImage && (
          <>
            {mode === 'onion' && (
              <OnionSkinMode oldImage={oldImage} newImage={newImage} frame={frame} panZoom={panZoom} anchor={anchor} blend={blend} onBlendChange={setBlend} overlay={overlay} />
            )}
            {mode === 'sideBySide' && <SideBySideMode oldImage={oldImage} newImage={newImage} frame={frame} panZoom={panZoom} anchor={anchor} overlay={overlay} />}
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
                overlay={overlay}
              />
            )}
            {mode === 'swipe' && <SwipeMode oldImage={oldImage} newImage={newImage} frame={frame} panZoom={panZoom} anchor={anchor} overlay={overlay} />}
          </>
        )}

        {/* Resized image: the anchor toggle asks how the two sizes align. Hidden when sizes match — it would do nothing. */}
        <ZoomControls
          panZoom={panZoom}
          anchor={isDiff && sizesDiffer ? anchor : null}
          onAnchorChange={setImageAnchor}
          comment={commentable ? { active: isCommenting, onToggle: () => setCommenting(!isCommenting) } : null}
        />
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

/** The images a viewport showing `sides` holds, by side. */
function imagesOn(sides: readonly ImageSide[], images: Record<ImageSide, DecodedImage | null>): Partial<Record<ImageSide, DecodedImage>> {
  return Object.fromEntries(sides.flatMap((side) => (images[side] ? [[side, images[side]]] : [])));
}
