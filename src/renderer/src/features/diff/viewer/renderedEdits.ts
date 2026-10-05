import type { FileContent } from '@shared/domain/content';

/** The unsaved text of a file that also renders (an SVG image, an OBJ model), rendered in place of the one on disk. */
export function renderedEdits(saved: FileContent, text: string): FileContent {
  if (!saved.image && !saved.model) return saved;
  const bytes = new TextEncoder().encode(text);
  return {
    ...saved,
    text,
    size: bytes.length,
    ...(saved.image && { image: { bytes, mimeType: saved.image.mimeType } }),
    ...(saved.model && { model: { bytes, format: saved.model.format } }),
  };
}
