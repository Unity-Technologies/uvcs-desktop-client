import { DataTexture, MeshBasicMaterial, MeshStandardMaterial, REVISION, type Event, type Material, type Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { releaseSharedDfgLut } from './sharedDfgLut';

/**
 * A renderer as three r186's is to the LUT (no WebGL in the tests): its materials' uniforms point at the one LUT, and
 * uploading it added a 'dispose' listener of its own, which removes itself when it fires (`onTextureDispose`).
 */
function rendererDrawing(lut: Texture, materials: Material[]) {
  const properties = new Map<Material, object>(materials.map((material) => [material, material instanceof MeshStandardMaterial ? { uniforms: { dfgLUT: { value: lut } } } : {}]));
  const onTextureDispose = (event: Event<'dispose', Texture>) => event.target.removeEventListener('dispose', onTextureDispose);
  lut.addEventListener('dispose', onTextureDispose);
  return { renderer: { properties: { get: (material: object) => properties.get(material as Material) ?? {} } } as never, materials, onTextureDispose };
}

describe('releaseSharedDfgLut', () => {
  it("detaches every renderer's listener from the shared LUT, found in a standard material's uniforms", () => {
    const lut = new DataTexture();
    const drawing = [0, 1, 2].map(() => rendererDrawing(lut, [new MeshBasicMaterial(), new MeshStandardMaterial()]));
    releaseSharedDfgLut(drawing[0]!.renderer, drawing[0]!.materials);
    for (const { onTextureDispose } of drawing) expect(lut.hasEventListener('dispose', onTextureDispose)).toBe(false);
  });

  it('does nothing where no material drew the LUT', () => {
    const lut = new DataTexture();
    const { renderer, onTextureDispose } = rendererDrawing(lut, []);
    releaseSharedDfgLut(renderer, [new MeshBasicMaterial()]);
    expect(lut.hasEventListener('dispose', onTextureDispose)).toBe(true);
  });

  it('is written for the three.js whose LUT holds on to every renderer: an upgrade checks it again', () => {
    // three r186's `getDFGLUT` (sharedDfgLut.ts): a newer three may free its listeners itself, or name the LUT another way.
    expect(REVISION).toBe('186');
  });
});
