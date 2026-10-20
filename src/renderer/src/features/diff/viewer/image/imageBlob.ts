import type { ImageBytes } from '@shared/domain/content';

/** An image's bytes as a Blob of its own type, which a blob URL serves (`useImageUrl`). */
export function imageBlob({ bytes, mimeType }: ImageBytes): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeType });
}
