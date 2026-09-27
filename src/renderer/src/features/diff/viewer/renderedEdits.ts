import type { FileContent } from '@shared/domain/content';

/** The unsaved text of a file that is also an image (SVG), rendered in place of the one on disk. */
export function renderedEdits(saved: FileContent, text: string): FileContent {
  if (!saved.image) return saved;
  const bytes = new TextEncoder().encode(text);
  return { ...saved, text, size: bytes.length, image: { bytes, mimeType: saved.image.mimeType } };
}
