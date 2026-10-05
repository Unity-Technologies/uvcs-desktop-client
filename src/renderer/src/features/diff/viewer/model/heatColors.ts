// The Differences mode's colors, from each vertex's distance to the other version (`compareSurfaces`): the version
// after keeps its clay where it is within the tolerance and turns to the accent as far as it moved, as the image
// diff's heatmap does; the version before shows, as a ghost, only where it is gone. Colors are linear RGB, as three's
// vertex colors take them.

export type Rgb = [number, number, number];

/** How far reads as "as changed as it gets": ten times the tolerance, or a fiftieth of the model. */
export function fullHeatAt(tolerance: number, modelSize: number): number {
  return Math.max(tolerance * 10, modelSize * 0.02, 1e-9);
}

/** The version after's vertex colors: `clay` within the tolerance, towards `hot` beyond it. */
export function heatColors(distances: Float32Array, tolerance: number, fullAt: number, clay: Rgb, hot: Rgb): Float32Array {
  const colors = new Float32Array(distances.length * 3);
  for (let v = 0; v < distances.length; v++) {
    const heat = heatOf(distances[v]!, tolerance, fullAt);
    // A change just past the tolerance is already a third of the way to the accent, so it can't be missed.
    const mix = heat === 0 ? 0 : 0.35 + 0.65 * heat;
    for (let channel = 0; channel < 3; channel++) colors[v * 3 + channel] = clay[channel]! + (hot[channel]! - clay[channel]!) * mix;
  }
  return colors;
}

/** The version before's ghost colors, RGBA: unseen within the tolerance, `gone` and more opaque the farther beyond. */
export function ghostColors(distances: Float32Array, tolerance: number, fullAt: number, gone: Rgb): Float32Array {
  const colors = new Float32Array(distances.length * 4);
  for (let v = 0; v < distances.length; v++) {
    const heat = heatOf(distances[v]!, tolerance, fullAt);
    colors.set(gone, v * 4);
    colors[v * 4 + 3] = heat === 0 ? 0 : 0.2 + 0.45 * heat;
  }
  return colors;
}

/** 0 within the tolerance, up to 1 at `fullAt`. The tolerance is compared as the distances are stored, in float32. */
function heatOf(distance: number, tolerance: number, fullAt: number): number {
  if (distance <= Math.fround(tolerance)) return 0;
  return Math.min(1, (distance - tolerance) / Math.max(fullAt - tolerance, 1e-9));
}
