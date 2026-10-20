// Images the browser can't decode made paintable (`paintableImage`) off the UI thread: a 4K PSD or EXR takes long
// enough to hold a paint. Apart from the image diff worker, so a decode never waits behind a comparison. What crosses
// back (the BMP's bytes) is transferred. This file is only the messaging.

import type { ImageBytes } from '@shared/domain/content';
import { paintableImage, type PaintableImage } from './paintableImage';

export type ImageDecodeRequest = { id: number; image: ImageBytes };
export type ImageDecodeResponse = { id: number; painted: PaintableImage };

// The renderer's tsconfig types the DOM, not lib.webworker: the worker's global with just what this file uses.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ImageDecodeRequest>) => void) | null;
  postMessage(message: ImageDecodeResponse, transfer?: Transferable[]): void;
};

// Every request is answered, a failure too: one left unanswered would leave its image loading for good.
scope.onmessage = ({ data: request }) => {
  let painted: PaintableImage;
  try {
    painted = paintableImage(request.image);
  } catch {
    painted = { status: 'failed', problem: 'unreadable' };
  }
  // A BMP made here is transferred; an image the browser paints as it was comes back as it went.
  const made = painted.status === 'paintable' && painted.image !== request.image ? [painted.image.bytes.buffer as ArrayBuffer] : [];
  scope.postMessage({ id: request.id, painted }, made);
};
