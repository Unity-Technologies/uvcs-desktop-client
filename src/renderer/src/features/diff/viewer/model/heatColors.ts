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

/**
 * How far towards the accent a vertex just past the tolerance already is: a third of the way and more, so a change
 * can't be missed. It reaches the accent at `heatFullAt`.
 */
export const HEAT_ONSET = 0.35;
/** The ghost's opacity just past the tolerance, and at `heatFullAt`: what is gone shows, never hiding the version after. */
export const GHOST_OPACITY = { onset: 0.2, full: 0.65 } as const;

/** A number as GLSL writes a float literal: `1` would be an int. */
function glslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

/** The vertex attribute holding each vertex's distance to the other version. */
export const DISTANCE_ATTRIBUTE = 'surfaceDistance';

/**
 * A mesh's distances to draw by, or null: the comparison and the scenes come apart (each a render after its read), so
 * for a moment the distances may be another pair's. One per vertex of the mesh, or none: a mesh shows its clay then.
 */
export function distancesToDraw(distances: Float32Array | undefined, vertices: number): Float32Array | null {
  return distances?.length === vertices ? distances : null;
}

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

/** The version after's material: its clay color within the tolerance, from `HEAT_ONSET` towards the accent beyond it. */
export function colorsByHeat(material: MeshStandardMaterial, scale: HeatScale): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, scale);
    shader.vertexShader = spliced(
      shader.vertexShader,
      ['#include <common>', `#include <common>\n${HEAT_OF}\nuniform vec3 heatClay;\nuniform vec3 heatHot;\nvarying vec3 vHeatColor;`],
      ['#include <color_vertex>', `#include <color_vertex>\nfloat heat = heatOf(${DISTANCE_ATTRIBUTE});\nvHeatColor = mix(heatClay, heatHot, heat == 0.0 ? 0.0 : mix(${glslFloat(HEAT_ONSET)}, 1.0, heat));`],
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
      ['#include <color_vertex>', `#include <color_vertex>\nfloat heat = heatOf(${DISTANCE_ATTRIBUTE});\nvGhostAlpha = heat == 0.0 ? 0.0 : mix(${glslFloat(GHOST_OPACITY.onset)}, ${glslFloat(GHOST_OPACITY.full)}, heat);`],
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
