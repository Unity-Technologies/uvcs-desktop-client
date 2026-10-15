// A soft contact shadow under a version, as Sketchfab grounds a model: the model seen from below the floor through an
// orthographic camera, each surface darker the nearer the floor it is (`MeshDepthMaterial`, its depth as alpha),
// blurred, and laid on a plane under the model. It is drawn when the model or its pose changes (`markStale`), never
// at each frame a gesture draws: the camera doesn't change it. A model that rises or sinks between the versions shows
// it against the shadow, as both versions share the floor, the lowest point of the two (`shadowFrameOf`).

import {
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  type Scene,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js';
import { spliced } from './heatColors';
import type { ModelScene } from './modelScene';
import type { BoundsLike } from './orbitCamera';

/** The camera layer the shadow is drawn from (the picker draws from 1): only the meshes' solids are on it. */
export const SHADOW_LAYER = 2;
/** The shadow's texture, in pixels a side: soft once blurred, so more would only cost. */
const RESOLUTION = 512;
/** How far the blur spreads, in texels of a 256 texture (three's contact shadows example). */
const BLUR = 3.5;
/** How much wider than the model's footprint the shadow's plane is, so the blur fades out within it. */
const MARGIN = 1.6;

/** Where the shadow lies: the floor under both versions, the square it covers, and how high above it a part still darkens it. */
export interface ShadowFrame {
  center: [number, number];
  floor: number;
  size: number;
  height: number;
}

export function shadowFrameOf(bounds: BoundsLike): ShadowFrame {
  const { min, max } = bounds;
  const width = max[0] - min[0];
  const depth = max[2] - min[2];
  const height = max[1] - min[1];
  return {
    center: [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2],
    // The ground grid lies on it too (`groundGridOf`).
    floor: min[1],
    size: Math.max(width, depth, height * 0.25, 1e-3) * MARGIN,
    height: Math.max(height, 1e-3),
  };
}

export class ContactShadow {
  /** The plane drawn under the model, in its side's scene. */
  readonly plane: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly drawn = new WebGLRenderTarget(RESOLUTION, RESOLUTION);
  private readonly blurred = new WebGLRenderTarget(RESOLUTION, RESOLUTION);
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly depth = new MeshDepthMaterial({ depthTest: false, depthWrite: false });
  private readonly horizontal = new ShaderMaterial({ ...HorizontalBlurShader, uniforms: { tDiffuse: { value: null }, h: { value: BLUR / 256 } }, depthTest: false });
  private readonly vertical = new ShaderMaterial({ ...VerticalBlurShader, uniforms: { tDiffuse: { value: null }, v: { value: BLUR / 256 } }, depthTest: false });
  private readonly blurQuad = new Mesh(new PlaneGeometry(2, 2));
  private stale = true;

  constructor() {
    for (const target of [this.drawn, this.blurred]) target.texture.generateMipmaps = false;
    // Black, as dark as the surface is near the floor: three's depth material draws its depth as gray, wholly opaque.
    this.depth.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.fragmentShader = spliced(shader.fragmentShader, ['gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), 1.0 - fragCoordZ );']);
    };
    this.plane = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: this.drawn.texture, transparent: true, depthWrite: false }));
    // Under the grid's lines, which are drawn after it.
    this.plane.renderOrder = -1;
    this.plane.raycast = () => {};
    this.camera.layers.set(SHADOW_LAYER);
    // The blur draws a quad filling the camera's view: its own camera, looking at it from the front.
    this.blurQuad.frustumCulled = false;
  }

  /** The model or its pose changed: drawn again before the next frame. */
  markStale(): void {
    this.stale = true;
  }

  /** Lays the plane over `frame`, how dark it is, and draws the shadow if it is stale. */
  update(renderer: WebGLRenderer, scene: Scene, model: ModelScene, frame: ShadowFrame, opacity: number): void {
    this.plane.position.set(frame.center[0], frame.floor, frame.center[1]);
    // Mirrored along Z: the camera below sees +Z at the top of the texture, which the plane lays towards -Z.
    this.plane.scale.set(frame.size, 1, -frame.size);
    this.plane.material.opacity = opacity;
    if (!this.stale) return;
    this.stale = false;
    this.draw(renderer, scene, model, frame);
  }

  private draw(renderer: WebGLRenderer, scene: Scene, model: ModelScene, frame: ShadowFrame): void {
    const half = frame.size / 2;
    Object.assign(this.camera, { left: -half, right: half, top: half, bottom: -half, near: 0, far: frame.height });
    // From under the floor, looking up: what is nearest the floor is nearest the camera, and darkest.
    this.camera.position.set(frame.center[0], frame.floor, frame.center[1]);
    this.camera.rotation.set(Math.PI / 2, 0, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    // The solids cast it whatever the mode shows (the wireframe, Diffs' heat): the same shape.
    const shown = model.meshes.map((mesh) => mesh.solid.visible);
    for (const mesh of model.meshes) mesh.solid.visible = true;
    const clearColor = renderer.getClearColor(new Color());
    const clearAlpha = renderer.getClearAlpha();
    const target = renderer.getRenderTarget();
    renderer.setClearColor(0x000000, 0);
    scene.overrideMaterial = this.depth;
    renderer.setRenderTarget(this.drawn);
    renderer.clear();
    renderer.render(scene, this.camera);
    scene.overrideMaterial = null;
    model.meshes.forEach((mesh, i) => (mesh.solid.visible = shown[i]!));
    this.blur(renderer, 1);
    this.blur(renderer, 0.4);
    renderer.setRenderTarget(target);
    renderer.setClearColor(clearColor, clearAlpha);
  }

  /** A pass of each blur, `amount` of `BLUR`: drawn into the other target and back. */
  private blur(renderer: WebGLRenderer, amount: number): void {
    this.horizontal.uniforms.tDiffuse!.value = this.drawn.texture;
    this.horizontal.uniforms.h!.value = (BLUR * amount) / 256;
    this.blurQuad.material = this.horizontal;
    renderer.setRenderTarget(this.blurred);
    renderer.render(this.blurQuad, BLUR_CAMERA);
    this.vertical.uniforms.tDiffuse!.value = this.blurred.texture;
    this.vertical.uniforms.v!.value = (BLUR * amount) / 256;
    this.blurQuad.material = this.vertical;
    renderer.setRenderTarget(this.drawn);
    renderer.render(this.blurQuad, BLUR_CAMERA);
  }

  dispose(): void {
    for (const target of [this.drawn, this.blurred]) target.dispose();
    for (const material of [this.depth, this.horizontal, this.vertical, this.plane.material]) material.dispose();
    this.plane.geometry.dispose();
    this.blurQuad.geometry.dispose();
  }
}

/** Looks at the blur's quad, which fills -1..1, from the front. */
const BLUR_CAMERA = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
BLUR_CAMERA.position.z = 1;
