import { MeshDepthMaterial, ShaderLib, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { describe, expect, it } from 'vitest';
import { SHADOW_LAYER, shadowFrameOf, shadowsByDepth } from './contactShadow';
import { PICK_LAYER } from './meshPicker';

describe('shadowFrameOf', () => {
  it('lays the floor at the lowest point, not at the pivot: a model whose pivot is at its middle stands on it', () => {
    expect(shadowFrameOf({ min: [-0.2, -0.17, -0.21], max: [0.22, 0.17, 0.21] }).floor).toBe(-0.17);
  });

  it('centers a square 1.6 times the wider side of the footprint under it, so the blur fades out inside it', () => {
    const frame = shadowFrameOf({ min: [10, 0, -2], max: [14, 1.8, 0] });
    expect(frame.center).toEqual([12, -1]);
    expect(frame.size).toBeCloseTo(4 * 1.6);
  });

  it('sizes the square of a tall, thin model by a quarter of its height, so a pole or a tree still casts a pool', () => {
    expect(shadowFrameOf({ min: [-0.1, 0, -0.1], max: [0.1, 10, 0.1] }).size).toBeCloseTo(2.5 * 1.6);
  });

  it('darkens up to the height of the model above the floor', () => {
    expect(shadowFrameOf({ min: [-1, 0.5, -1], max: [1, 2.5, 1] }).height).toBe(2);
  });

  it('keeps a size and a height for a flat or empty model', () => {
    const frame = shadowFrameOf({ min: [0, 0, 0], max: [0, 0, 0] });
    expect(frame.size).toBeGreaterThan(0);
    expect(frame.height).toBeGreaterThan(0);
  });
});

describe('shadowsByDepth', () => {
  it("draws three's own depth shader black, as opaque as the surface is near the floor", () => {
    const material = new MeshDepthMaterial();
    shadowsByDepth(material);
    const shader = { ...ShaderLib.depth, uniforms: {} } as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as WebGLRenderer);
    expect(shader.fragmentShader).toContain('gl_FragColor = vec4( vec3( 0.0 ), 1.0 - fragCoordZ );');
  });
});

describe('SHADOW_LAYER', () => {
  it("is not the picker's: the shadow camera sees only the solids, never what the picker draws", () => {
    expect(SHADOW_LAYER).not.toBe(PICK_LAYER);
  });
});
