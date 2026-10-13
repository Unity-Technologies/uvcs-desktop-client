// The Materials look's texture decoding off the UI thread (`decodeTexture`): a 4K PSD or EXR takes long enough to
// hold a paint. Apart from the model worker, so the next model's read never waits behind the last one's textures.
// What crosses back (the bitmap) is transferred. This file is only the messaging.

import { decodeTexture, type TextureDecodeRequest, type TextureDecoded } from './decodeTexture';

export type TextureWorkerRequest = { id: number; decode: TextureDecodeRequest };
export type TextureWorkerResponse = { id: number; decoded: TextureDecoded };

// The renderer's tsconfig types the DOM, not lib.webworker: the worker's global with just what this file uses.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<TextureWorkerRequest>) => void) | null;
  postMessage(message: TextureWorkerResponse, transfer?: Transferable[]): void;
};

// Every request is answered, a failure too: one left unanswered would leave its texture loading for good.
scope.onmessage = async ({ data: request }) => {
  const decoded = await decodeTexture(request.decode).catch((): TextureDecoded => ({ kind: 'failed', problem: 'unreadable' }));
  scope.postMessage({ id: request.id, decoded }, decoded.kind === 'decoded' ? [decoded.bitmap] : []);
};
