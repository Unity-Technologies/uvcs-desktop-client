import { DataTexture, MeshBasicMaterial, MeshStandardMaterial, REVISION, type Event, type Material, type Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { sharedDfgLutOf } from './sharedDfgLut';

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

describe('sharedDfgLutOf', () => {
  it("finds the shared LUT in a standard material's uniforms; disposed, every renderer's listener detaches", () => {
    const lut = new DataTexture();
    const drawing = [0, 1, 2].map(() => rendererDrawing(lut, [new MeshBasicMaterial(), new MeshStandardMaterial()]));
    const [first] = drawing;
    expect(sharedDfgLutOf(first!.renderer, first!.materials)).toBe(lut);
    lut.dispose();
    for (const { onTextureDispose } of drawing) expect(lut.hasEventListener('dispose', onTextureDispose)).toBe(false);
  });

  it('finds none where no material drew the LUT', () => {
    const { renderer } = rendererDrawing(new DataTexture(), []);
    expect(sharedDfgLutOf(renderer, [new MeshBasicMaterial()])).toBeNull();
  });

  it('is written for the three.js whose LUT holds on to every renderer: an upgrade checks it again', () => {
    // three r186's `getDFGLUT` (sharedDfgLut.ts): a newer three may free its listeners itself, or name the LUT another way.
    expect(REVISION).toBe('186');
  });
});
