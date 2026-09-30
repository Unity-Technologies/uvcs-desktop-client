// The frame an image diff is composed in: both revisions laid out in one frame, as big as the larger of the two, so
// every mode, the pixel comparison and the pixel inspector agree on where each pixel of each revision sits.
// The pixel passes are in `pixelComparison` and `changedRegions`, the pan and zoom geometry in `viewTransform`.

export interface Size {
  width: number;
  height: number;
}

/**
 * How two revisions of different sizes are aligned in the composed frame: 'center' keeps a resized asset anchored
 * (the UVCS convention); 'top-left' matches how canvases usually grow (sprite sheets, a screenshot that gained a
 * footer), so a grown image doesn't read as everything moved by half the difference.
 */
export type AnchorMode = 'center' | 'top-left';

/** The composed frame of two revisions: the larger of their sizes on each axis. */
export function composedSize(a: Size, b: Size): Size {
  return { width: Math.max(a.width, b.width), height: Math.max(a.height, b.height) };
}

/** Where a revision of `size` starts in the composed `frame` for the anchor (centered offsets floor to a whole pixel). */
export function anchoredOffset(frame: Size, size: Size, anchor: AnchorMode): { x: number; y: number } {
  if (anchor === 'top-left') return { x: 0, y: 0 };
  return {
    x: Math.floor((frame.width - size.width) / 2),
    y: Math.floor((frame.height - size.height) / 2),
  };
}
