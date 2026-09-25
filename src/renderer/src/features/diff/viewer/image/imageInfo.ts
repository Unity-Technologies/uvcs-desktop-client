import { formatSize } from '../../../../lib/formatDate';

/** "1024×768 · 245 KB": one revision's identity card for the info strip. */
export function sideLabel(image: { width: number; height: number }, bytes: number): string {
  return `${image.width}×${image.height} · ${formatSize(bytes)}`;
}

/**
 * The % readout must stay honest: with a tolerance applied, zero changes means
 * "nothing above the tolerance", not "pixel-identical".
 */
export function changedLabel(changedPixels: number, coveredPixels: number, threshold: number): string | null {
  if (coveredPixels === 0) return null;
  if (changedPixels === 0) return threshold > 0 ? 'no changes above tolerance' : 'pixel-identical';
  const percent = (changedPixels / coveredPixels) * 100;
  return `${percent < 0.1 ? '< 0.1' : percent.toFixed(1)}% of pixels differ`;
}
