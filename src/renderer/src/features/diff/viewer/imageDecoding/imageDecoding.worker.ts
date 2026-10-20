// Image decoding off the UI thread, for the model diff's Materials look (`decodeTexture`: a bitmap for the GPU) and
// for whatever paints an image the browser can't decode (`paintableImage`: the image diff, the merge page's cards): a
// 4K PSD or EXR takes long enough to hold a paint. One worker for both, so three's loaders load in one thread, once.
// Apart from the model worker, so the next model's read never waits behind the last one's textures. What crosses
// back (a bitmap, a BMP's Blob) is transferred or handed over, never copied. This file is only the messaging.

import type { ImageBytes } from '@shared/domain/content';
import { paintableImage, type PaintableImage } from '../image/paintableImage';
import { decodeTexture, type TextureDecodeRequest, type TextureDecoded } from '../model/textures/decodeTexture';

export type ImageDecodingRequest = { id: number; decode: TextureDecodeRequest } | { id: number; paint: ImageBytes };
export type ImageDecodingResponse = { id: number; decoded: TextureDecoded } | { id: number; painted: PaintableImage };

// The renderer's tsconfig types the DOM, not lib.webworker: the worker's global with just what this file uses.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ImageDecodingRequest>) => void) | null;
  postMessage(message: ImageDecodingResponse, transfer?: Transferable[]): void;
};

// Every request is answered, a failure too: one left unanswered would leave its texture or image loading for good.
scope.onmessage = async ({ data: request }) => {
  if ('paint' in request) return answerPaint(request.id, request.paint);
  const decoded = await decodeTexture(request.decode).catch((): TextureDecoded => ({ kind: 'failed', problem: 'unreadable' }));
  scope.postMessage({ id: request.id, decoded }, decoded.kind === 'decoded' ? [decoded.bitmap] : []);
};

function answerPaint(id: number, image: ImageBytes): void {
  let painted: PaintableImage;
  try {
    painted = paintableImage(image);
  } catch {
    painted = { status: 'failed', problem: 'unreadable' };
  }
  // A Blob crosses as a handle to its bytes, which stay out of the page's heap.
  scope.postMessage({ id, painted });
}
