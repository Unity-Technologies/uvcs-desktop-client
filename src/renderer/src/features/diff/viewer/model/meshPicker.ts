// What is under the pointer, read on the GPU: the side's pickable meshes drawn into one float pixel through a camera
// narrowed to the window under the pointer (`pickWindowAt`), each writing where its surface is and which mesh it is
// (`pickedAt`). Three's `Raycaster` tested every triangle of a mesh on the main thread: a wheel notch, a click or a pan
// on a 3-million-triangle model froze the view for 150 ms. Drawn so, a pick costs one draw of what the narrowed
// camera sees (three culls every mesh whose bounds miss the window) and one pixel read back, and it picks what is
// drawn: a skinned mesh posed by a take, a blendshape, exactly as shown, and only the faces its material draws (a
// double-sided leaf card from behind too: `facesOf`); an alpha-clipped hole still picks the card. A GPU that can't draw into float pixels
// (`EXT_color_buffer_float`, which WebGL 2 has nearly everywhere) has `supported` false: the renderer raycasts then.

import { BackSide, BufferAttribute, BufferGeometry, Color, DoubleSide, FloatType, type GeometryGroup, Mesh, PerspectiveCamera, Scene, ShaderMaterial, type Material, type WebGLRenderer, WebGLRenderTarget } from 'three';
import { pickedAt, type PickWindow } from './pickWindow';

/** The layer the pickable meshes are on, beside the default one everything is drawn on. */
const PICK_LAYER = 1;

export class MeshPicker {
  private readonly target = new WebGLRenderTarget(1, 1, { type: FloatType, depthBuffer: true });
  private readonly material = pickMaterial();
  private readonly camera = new PerspectiveCamera();
  private readonly pixel = new Float32Array(4);

  /**
   * Makes these objects (a mesh and its wireframe twin: either may be what shows) pickable as the side's mesh of
   * this place. Only what is visible is drawn, as for the eye.
   */
  static makePickable(objects: Mesh[], mesh: number): void {
    for (const object of objects) {
      object.layers.enable(PICK_LAYER);
      // The picking pass's one material tells each mesh apart, and draws the faces its own material draws, by these
      // uniforms, set as three draws each mesh (and each slot of it: `group`).
      object.onBeforeRender = (_renderer, _scene, _camera, _geometry, material: Material, group: unknown) => {
        if (!(material instanceof ShaderMaterial) || material.userData.picks !== true) return;
        material.uniforms.mesh!.value = mesh + 1;
        // Three passes the geometry's group drawn (null without groups); its types say an Object3D `Group`.
        material.uniforms.faces!.value = facesOf(object.material, group as GeometryGroup | null);
        material.uniformsNeedUpdate = true;
      };
    }
  }

  static supported(renderer: WebGLRenderer): boolean {
    return renderer.extensions.has('EXT_color_buffer_float');
  }

  /**
   * Has the GPU compile the picking pass now, for meshes neither skinned nor with blendshapes (the big ones), as it
   * would draw into the picking pixel: compiling at the first pick held the first click or wheel notch on each model
   * for 100 ms. The GPU compiles in parallel (`KHR_parallel_shader_compile`): this doesn't wait for it.
   */
  prepare(renderer: WebGLRenderer, camera: PerspectiveCamera): void {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    const target = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.compile(new Scene().add(new Mesh(geometry, this.material)), camera);
    renderer.setRenderTarget(target);
    geometry.dispose();
  }

  /** The mesh of `scene` seen through `camera` at the window, and the point of it there; null where none is. */
  pick(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, at: PickWindow): { mesh: number; point: [number, number, number] } | null {
    this.camera.copy(camera);
    this.camera.layers.set(PICK_LAYER);
    this.camera.setViewOffset(at.full.width, at.full.height, at.offset.x, at.offset.y, 1, 1);
    const target = renderer.getRenderTarget();
    const clearColor = renderer.getClearColor(new Color());
    const clearAlpha = renderer.getClearAlpha();
    const override = scene.overrideMaterial;
    try {
      scene.overrideMaterial = this.material;
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, this.camera);
      renderer.readRenderTargetPixels(this.target, 0, 0, 1, 1, this.pixel);
    } finally {
      scene.overrideMaterial = override;
      renderer.setRenderTarget(target);
      renderer.setClearColor(clearColor, clearAlpha);
    }
    return pickedAt(this.pixel);
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}

/**
 * Which faces the mesh's own material draws for this slot, as the picking pass takes them: 0 the front, 1 the back,
 * 2 both. The pass itself draws both, and drops the others; flipping its `side` for each draw would compile it again.
 */
export function facesOf(material: Material | Material[], group: Pick<GeometryGroup, 'materialIndex'> | null): number {
  const drawn = Array.isArray(material) ? material[group?.materialIndex ?? 0] : material;
  return drawn?.side === DoubleSide ? 2 : drawn?.side === BackSide ? 1 : 0;
}

/** Writes the surface's point in the viewer's space and the mesh's place plus one, deformed as drawn (skin, blendshapes). */
function pickMaterial(): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: { mesh: { value: 0 }, faces: { value: 0 } },
    side: DoubleSide,
    vertexShader: `
      #include <common>
      #include <morphtarget_pars_vertex>
      #include <skinning_pars_vertex>
      varying vec3 vPoint;
      void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <morphtarget_vertex>
        #include <skinning_vertex>
        #include <project_vertex>
        vPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;
      }`,
    fragmentShader: `
      uniform float mesh;
      uniform int faces;
      varying vec3 vPoint;
      void main() {
        if ((faces == 0 && !gl_FrontFacing) || (faces == 1 && gl_FrontFacing)) discard;
        gl_FragColor = vec4(vPoint, mesh);
      }`,
  });
  material.userData.picks = true;
  return material;
}
