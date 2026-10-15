// What is under the pointer, read on the GPU: the side's pickable meshes drawn into one float pixel through a camera
// narrowed to the window under the pointer (`pickWindowAt`), each writing where its surface is and which mesh it is
// (`pickedAt`). Three's `Raycaster` tested every triangle of a mesh on the main thread: a wheel notch, a click or a pan
// on a 3-million-triangle model froze the view for 150 ms. Drawn so, a pick costs one draw of what the narrowed
// camera sees (three culls every mesh whose bounds miss the window) and one pixel read back, and it picks what is
// drawn: a skinned mesh posed by a take, a blendshape, exactly as shown. A GPU that can't draw into float pixels
// (`EXT_color_buffer_float`, which WebGL 2 has nearly everywhere) has `supported` false: the renderer raycasts then.

import { Color, FloatType, PerspectiveCamera, ShaderMaterial, type Material, type Mesh, type Scene, type WebGLRenderer, WebGLRenderTarget } from 'three';
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
      // The picking pass's one material tells each mesh apart by this uniform, set as three draws the mesh.
      object.onBeforeRender = (_renderer, _scene, _camera, _geometry, material: Material) => {
        if (!(material instanceof ShaderMaterial) || material.userData.picks !== true) return;
        material.uniforms.mesh!.value = mesh + 1;
        material.uniformsNeedUpdate = true;
      };
    }
  }

  static supported(renderer: WebGLRenderer): boolean {
    return renderer.extensions.has('EXT_color_buffer_float');
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

/** Writes the surface's point in the viewer's space and the mesh's place plus one, deformed as drawn (skin, blendshapes). */
function pickMaterial(): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: { mesh: { value: 0 } },
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
      varying vec3 vPoint;
      void main() {
        gl_FragColor = vec4(vPoint, mesh);
      }`,
  });
  material.userData.picks = true;
  return material;
}
