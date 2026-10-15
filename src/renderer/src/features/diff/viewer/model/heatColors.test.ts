import { MeshBasicMaterial, MeshStandardMaterial, ShaderLib, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { colorsByHeat, DISTANCE_ATTRIBUTE, fadesByHeat, distancesToDraw, fullHeatAt, GHOST_OPACITY, HEAT_ONSET, heatScale, spliced } from './heatColors';

/** The shader three would compile for the material, as its `onBeforeCompile` leaves it. */
function compiled(material: MeshStandardMaterial | MeshBasicMaterial, shader: { vertexShader: string; fragmentShader: string }) {
  const parameters = { ...shader, uniforms: {} } as WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(parameters, {} as WebGLRenderer);
  return parameters;
}

describe('colorsByHeat', () => {
  it("colors the version after in three's own shader, by each vertex's distance, from the shared tolerance", () => {
    const scale = heatScale();
    const material = new MeshStandardMaterial();
    colorsByHeat(material, scale);
    const shader = compiled(material, ShaderLib.standard);
    expect(shader.vertexShader).toContain(`attribute float ${DISTANCE_ATTRIBUTE};`);
    expect(shader.vertexShader).toContain('vHeatColor = mix(heatClay, heatHot, heat == 0.0 ? 0.0 : mix(0.35, 1.0, heat));');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb *= vHeatColor;');
    // The very objects: moving the slider sets their values, and the GPU recolors without compiling again.
    expect(shader.uniforms.heatTolerance).toBe(scale.heatTolerance);
    expect(shader.uniforms.heatHot).toBe(scale.heatHot);
  });
});

describe('fadesByHeat', () => {
  it('fades the version before by each vertex distance, in its own color', () => {
    const scale = heatScale();
    const material = new MeshBasicMaterial();
    fadesByHeat(material, scale);
    const shader = compiled(material, ShaderLib.basic);
    expect(shader.vertexShader).toContain('vGhostAlpha = heat == 0.0 ? 0.0 : mix(0.2, 0.65, heat);');
    expect(shader.fragmentShader).toContain('diffuseColor.a *= vGhostAlpha;');
    expect(shader.uniforms.heatFullAt).toBe(scale.heatFullAt);
  });
});

describe('the heat colors', () => {
  it('shows a change just past the tolerance clearly: already a third of the way to the accent', () => {
    expect(HEAT_ONSET).toBeGreaterThanOrEqual(1 / 3);
  });

  it('shows what is gone faintly just past the tolerance, and never hides the version after', () => {
    expect([GHOST_OPACITY.onset, GHOST_OPACITY.full]).toEqual([0.2, 0.65]);
  });
});

describe('spliced', () => {
  it("fails on a chunk the shader hasn't, rather than drawing without the heat", () => {
    expect(() => spliced('void main() {}', ['#include <color_vertex>', ''])).toThrow('#include <color_vertex>');
  });
});

describe('fullHeatAt', () => {
  it('is ten times the tolerance, or a fiftieth of the model when the tolerance is tiny', () => {
    expect(fullHeatAt(0.01, 1)).toBeCloseTo(0.1);
    expect(fullHeatAt(0, 10)).toBeCloseTo(0.2);
  });
});

describe('distancesToDraw', () => {
  it("draws a mesh's distances only when there is one per vertex of it: another model's would color it wrongly", () => {
    const distances = new Float32Array(3);
    expect([distancesToDraw(distances, 3), distancesToDraw(distances, 4), distancesToDraw(undefined, 3)]).toEqual([distances, null, null]);
  });
});
