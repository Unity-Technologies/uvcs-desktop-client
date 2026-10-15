// three r186 keeps one DFG lookup texture for the whole page (`getDFGLUT` in three.module.js, the `dfgLUT` uniform of
// every MeshStandardMaterial), and each WebGLRenderer that uploads it adds a 'dispose' listener of its own to it
// (`onTextureDispose`), a closure over the renderer's WebGL context and so its canvas. Nothing ever removed them: the
// page's one LUT kept every renderer ever made reachable, and through the canvas's listeners each `ModelRenderer` with
// its scenes, geometries and textures (hundreds of megabytes over a few models). Disposing the LUT as a renderer goes
// fires that 'dispose': every renderer's listener frees its copy and detaches. A renderer still drawing (another
// viewer, a merge card's) uploads it again at its next draw: `setTexture2D` finds it no longer uploaded, and the LUT
// keeps its data. Upgrading three: check `getDFGLUT` still works this way (`sharedDfgLut.test.ts` pins the revision).

import type { Material, Texture, WebGLRenderer } from 'three';

/**
 * Lets go of the shared DFG LUT's hold on every renderer: call it as a renderer is disposed, before
 * `WebGLRenderer.dispose`, with the materials it drew (the LUT is found in their uniforms; one is enough).
 */
export function releaseSharedDfgLut(renderer: Pick<WebGLRenderer, 'properties'>, materials: Iterable<Material>): void {
  dfgLutOf(renderer, materials)?.dispose();
}

function dfgLutOf(renderer: Pick<WebGLRenderer, 'properties'>, materials: Iterable<Material>): Texture | null {
  for (const material of materials) {
    const uniforms = (renderer.properties.get(material) as { uniforms?: { dfgLUT?: { value: Texture | null } } }).uniforms;
    const lut = uniforms?.dfgLUT?.value;
    if (lut) return lut;
  }
  return null;
}
