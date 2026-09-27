import type { AnchorMode } from './imageDiff';
import type { DecodedImage } from './useDecodedImage';

const imageIds = new WeakMap<HTMLImageElement, number>();
let lastImageId = 0;

/**
 * Identity of a pair + anchor: each decoded image by a number, not its data URL. The key goes to the worker with every
 * tolerance move and is compared on every render, and the data URLs of two 16-megapixel PNGs are some 70 MB of text.
 */
export function compositionKey(oldImage: DecodedImage, newImage: DecodedImage, anchor: AnchorMode): string {
  return `${imageId(oldImage)} ${imageId(newImage)} ${anchor}`;
}

function imageId({ el }: DecodedImage): number {
  let id = imageIds.get(el);
  if (id === undefined) imageIds.set(el, (id = ++lastImageId));
  return id;
}
