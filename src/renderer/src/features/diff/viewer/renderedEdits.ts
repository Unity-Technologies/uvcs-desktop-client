import type { FileContent } from '@shared/domain/content';

/** The unsaved text of a file that is also an image (SVG), rendered in place of the one on disk. */
export function renderedEdits(saved: FileContent, text: string): FileContent {
  const mimeType = saved.imageDataUrl?.slice('data:'.length, saved.imageDataUrl.indexOf(';'));
  if (!mimeType) return saved;
  return { ...saved, text, size: new TextEncoder().encode(text).length, imageDataUrl: `data:${mimeType};charset=utf-8,${encodeURIComponent(text)}` };
}
