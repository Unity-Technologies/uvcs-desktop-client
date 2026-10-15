// The Differences mode's colors, from each vertex's distance to the other version (`compareSurfaces`): the version
// after keeps its clay where it is within the tolerance and turns to the accent as far as it moved, as the image
// diff's heatmap does; the version before shows, as a ghost, only where it is gone. Worked out on the GPU: each mesh
// holds its vertices' distances once (`surfaceDistance`, set by `ModelRenderer.setHeat`) and the tolerance is a
// uniform (`HeatScale`), so moving the slider costs the main thread nothing. Coloring every vertex on the main thread
// at each step of the slider held it 160 ms a step on a model of 3 million triangles.

import { Color, type MeshBasicMaterial, type MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three';

/** How far reads as "as changed as it gets": ten times the tolerance, or a fiftieth of the model. */
export function fullHeatAt(tolerance: number, modelSize: number): number {
  return Math.max(tolerance * 10, modelSize * 0.02, 1e-9);
}

/** The vertex attribute holding each vertex's distance to the other version. */
export const DISTANCE_ATTRIBUTE = 'surfaceDistance';

/** What the heat and ghost materials color by, shared as uniforms: setting a value recolors without compiling. */
export interface HeatScale {
  heatTolerance: { value: number };
  heatFullAt: { value: number };
  heatClay: { value: Color };
  heatHot: { value: Color };
}

export function heatScale(): HeatScale {
  return { heatTolerance: { value: 0 }, heatFullAt: { value: 1 }, heatClay: { value: new Color() }, heatHot: { value: new Color() } };
}

/**
 * 0 within the tolerance, up to 1 at `heatFullAt`. The tolerance is compared as the distances are stored, in float32,
 * as `changedRegions` and `changeShares` compare them.
 */
const HEAT_OF = `
  attribute float ${DISTANCE_ATTRIBUTE};
  uniform float heatTolerance;
  uniform float heatFullAt;
  float heatOf(float distance) {
    if (distance <= heatTolerance) return 0.0;
    return min(1.0, (distance - heatTolerance) / max(heatFullAt - heatTolerance, 1e-9));
  }
`;

/**
 * The version after's material: its clay color within the tolerance, towards the accent beyond it. A change just past
 * the tolerance is already a third of the way to the accent, so it can't be missed.
 */
export function colorsByHeat(material: MeshStandardMaterial, scale: HeatScale): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, scale);
    shader.vertexShader = spliced(
      shader.vertexShader,
      ['#include <common>', `#include <common>\n${HEAT_OF}\nuniform vec3 heatClay;\nuniform vec3 heatHot;\nvarying vec3 vHeatColor;`],
      ['#include <color_vertex>', `#include <color_vertex>\nfloat heat = heatOf(${DISTANCE_ATTRIBUTE});\nvHeatColor = mix(heatClay, heatHot, heat == 0.0 ? 0.0 : 0.35 + 0.65 * heat);`],
    );
    shader.fragmentShader = spliced(shader.fragmentShader, ['#include <common>', '#include <common>\nvarying vec3 vHeatColor;'], ['#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vHeatColor;']);
  };
}

/** The version before's ghost: its color (`material.color`) unseen within the tolerance, more opaque the farther beyond. */
export function fadesByHeat(material: MeshBasicMaterial, scale: HeatScale): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, scale);
    shader.vertexShader = spliced(
      shader.vertexShader,
      ['#include <common>', `#include <common>\n${HEAT_OF}\nvarying float vGhostAlpha;`],
      ['#include <color_vertex>', `#include <color_vertex>\nfloat heat = heatOf(${DISTANCE_ATTRIBUTE});\nvGhostAlpha = heat == 0.0 ? 0.0 : 0.2 + 0.45 * heat;`],
    );
    shader.fragmentShader = spliced(shader.fragmentShader, ['#include <common>', '#include <common>\nvarying float vGhostAlpha;'], ['#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vGhostAlpha;']);
  };
}

/** The shader with each chunk replaced once; a chunk three no longer has throws, rather than drawing clay unseen. */
export function spliced(shader: string, ...replacements: [string, string][]): string {
  return replacements.reduce((source, [chunk, replacement]) => {
    if (!source.includes(chunk)) throw new Error(`The shader has no ${chunk}`);
    return source.replace(chunk, replacement);
  }, shader);
}
