import type { AnchorMode } from './composedFrame';
import type { DecodedImage } from './useDecodedImage';

const imageIds = new WeakMap<HTMLImageElement, number>();
let lastImageId = 0;

/**
 * Names a pair and its anchor for the heatmap's cache and the worker: each decoded image by a number, so the key stays
 * a few characters however big the images (it crosses to the worker at every tolerance move and is compared at every
 * render), and an image decoded anew is compared anew.
 */
export function compositionKey(oldImage: DecodedImage, newImage: DecodedImage, anchor: AnchorMode): string {
  return `${imageId(oldImage)} ${imageId(newImage)} ${anchor}`;
}

function imageId({ element }: DecodedImage): number {
  let id = imageIds.get(element);
  if (id === undefined) imageIds.set(element, (id = ++lastImageId));
  return id;
}
