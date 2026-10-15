// A still of a model, as the model diff shows it (clay, from its first view, the theme's backdrop): for the merge
// page's cards, where a live view per version would be too much. Drawn once on a canvas of its own, read back at once,
// and the canvas and its GPU memory let go.

import type { ModelPalette } from './modelPalette';
import { framedBounds } from './modelFraming';
import { ModelRenderer } from './modelRenderer';
import { buildModelScene } from './modelScene';
import type { ModelSummary } from './modelSummary';
import { framedView } from './orbitCamera';
import type { ParsedModel } from './parsedModel';

export function modelThumbnail(model: ParsedModel, summary: ModelSummary, palette: ModelPalette, width: number, height: number): string | null {
  const bounds = framedBounds(summary);
  if (!bounds) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const renderer = new ModelRenderer(canvas, { picks: false });
  const scene = buildModelScene(model, summary);
  try {
    renderer.setSize(width, height, window.devicePixelRatio);
    renderer.setPalette(palette);
    renderer.setModels(null, scene, bounds);
    renderer.setView(framedView(bounds, width / height));
    renderer.renderNow();
    // Read back in the same task as the draw: the drawing buffer is kept until then without `preserveDrawingBuffer`.
    return canvas.toDataURL('image/png');
  } finally {
    renderer.dispose();
    scene.dispose();
  }
}
