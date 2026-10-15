// Draws a model diff on one WebGL canvas: each version in a scene of its own (a studio light, the 1 m grid Unity's
// Scene view shows, the model's pivot) seen through one camera, laid out by the mode (`layoutOf`). It draws only
// when asked (`requestRender`: a gesture, a mode, a look; at once for a still or a resize, `renderNow`), never on a
// loop: an idle diff costs the GPU nothing. The onion skin draws each version apart and blends them, so it blends
// what is seen, not the meshes' depths.

import {
  AxesHelper,
  Box3,
  Box3Helper,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  NeutralToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Intersection,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { canvasSizeChanged, canvasSizeOf, type CanvasSize } from './canvasSize';
import { LookTextures, SlotLookMaterials } from './materials/slotLookMaterials';
import type { SlotLook } from './materials/materialPlan';
import type { ModelPalette } from './modelPalette';
import { slotColor } from './modelPalette';
import { modelOrientation, type ModelScene } from './modelScene';
import { cameraPositionOf, clipPlanesOf, FIELD_OF_VIEW, type BoundsLike, type OrbitView, type Ray, type Vector } from './orbitCamera';
import type { SurfaceLook } from './surfaceLook';
import { layoutOf, paneAt, type Layout, type ModelLayoutMode, type Side } from './viewLayout';

export type DrawMode = 'shaded' | 'wireframe' | 'shadedWireframe';

export interface ModelLook {
  drawMode: DrawMode;
  /** Clay, each material slot in its color, or its material (`setMaterialLooks`). */
  surface: SurfaceLook;
  /** Node keys lit up on each side; the rest fade while any is. */
  highlighted: { before: Set<string>; after: Set<string> };
}

/** The Differences mode's colors, per mesh of each version (`heatColors`, `ghostColors`); null until compared. */
export interface ModelHeat {
  before: Float32Array[];
  after: Float32Array[];
}

export interface ModelLayoutState {
  /** How two versions are compared; a version shown alone (added, deleted) takes the whole canvas whatever it is. */
  mode: Exclude<ModelLayoutMode, 'single'>;
  /** The onion skin's mix: 0 all before, 1 all after. */
  blend: number;
  /** The swipe divider, as a fraction of the width. */
  split: number;
}

interface SideScene {
  scene: Scene;
  model: ModelScene;
  key: DirectionalLight;
  /** Where the nodes picked that draw nothing (bones, empties) are, as dots on top of everything. */
  markers: Points<BufferGeometry, ShaderMaterial>;
  /** The model's pivot: its axes at the origin, turned as the model is (`modelOrientation`), on top of everything. */
  pivot: AxesHelper;
  /** The skeleton: a line from each bone to its parent and a dot at each joint, on top of the model. */
  skeleton: LineSegments<BufferGeometry, LineBasicMaterial>;
  joints: Points<BufferGeometry, ShaderMaterial>;
  /** Each mesh's materials as the Materials look draws them, made the first time it does. */
  looks: SlotLookMaterials;
}

/** How much a node that isn't lit up fades towards the backdrop while others are. */
const FADE = 0.7;

export class ModelRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 1000);
  private readonly environment: Texture;
  private readonly sides: Record<Side, SideScene | null> = { before: null, after: null };
  /** Both versions' bounds together, in the viewer's space: the grid and the clip planes cover them. */
  private bounds: BoundsLike = { min: [-1, -1, -1], max: [1, 1, 1] };
  private readonly grid = new Group();
  /** The changed region stepped to, boxed in the accent. */
  private readonly region = new Box3Helper(new Box3());
  private view: OrbitView = { target: [0, 0, 0], yaw: 0, pitch: 0, distance: 5 };
  private layoutState: ModelLayoutState = { mode: 'sideBySide', blend: 0.5, split: 0.5 };
  private look: ModelLook = { drawMode: 'shaded', surface: 'clay', highlighted: { before: new Set(), after: new Set() } };
  /** Each side's slots as the Materials look draws them (`slotLooks`); a slot absent stays clay. */
  private materialLooks: Record<Side, ReadonlyMap<string, SlotLook> | null> = { before: null, after: null };
  /** The GPU textures of the decoded bitmaps the looks use, one per bitmap and use, shared by the sides. */
  private readonly lookTextures: LookTextures;
  private palette: ModelPalette | null = null;
  private heat: ModelHeat | null = null;
  private showBones = false;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  /** The size last given to the canvas; null until then, when it has the browser's default size. */
  private applied: CanvasSize | null = null;
  private frame = 0;
  private targets: [WebGLRenderTarget, WebGLRenderTarget] | null = null;
  private readonly blender = new Blender();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    // Clay lit by a studio clips to white without it; the onion skin's blend applies the same (`Blender`).
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setScissorTest(true);
    // Each frame clears once, itself: the Differences mode draws the version before over the one after, in its depth.
    this.renderer.autoClear = false;
    this.region.visible = false;
    (this.region.material as LineBasicMaterial).depthTest = false;
    this.region.renderOrder = 15;
    // A soft studio for the clay to read its shape in, from every side: three's procedural room, no file to load.
    const generator = new PMREMGenerator(this.renderer);
    this.environment = generator.fromScene(new RoomEnvironment(), 0.04).texture;
    generator.dispose();
    canvas.addEventListener('webglcontextrestored', this.requestRender);
    this.lookTextures = new LookTextures(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
  }

  setModels(before: ModelScene | null, after: ModelScene | null, bounds: BoundsLike): void {
    for (const side of ['before', 'after'] as const) {
      const model = side === 'before' ? before : after;
      const current = this.sides[side];
      if (current?.model === model) continue;
      if (current) disposeSide(current);
      // The looks were the replaced model's: the next model's come with `setMaterialLooks`.
      this.materialLooks = { ...this.materialLooks, [side]: null };
      this.sides[side] = model && this.sceneOf(model);
    }
    this.lookTextures.keepOnly(this.materialLooks);
    this.bounds = bounds;
    this.rebuildGrid();
    this.applyLook();
    this.requestRender();
  }

  setView(view: OrbitView): void {
    this.view = view;
    this.requestRender();
  }

  setLayout(layout: ModelLayoutState): void {
    const modeChanged = layout.mode !== this.layoutState.mode;
    this.layoutState = layout;
    if (modeChanged) this.applyLook();
    this.requestRender();
  }

  /** Draws each version's skeleton over it, or not. */
  setShowBones(show: boolean): void {
    this.showBones = show;
    this.requestRender();
  }

  /** Boxes a region of the viewer's space (the changed region stepped to); null takes the box away. */
  setRegion(region: BoundsLike | null): void {
    this.region.visible = region !== null;
    if (region) this.region.box.set(new Vector3(...region.min), new Vector3(...region.max));
    this.requestRender();
  }

  /** The Differences mode's colors, set on each mesh's geometry; null shows the clay there until they come. */
  setHeat(heat: ModelHeat | null): void {
    this.heat = heat;
    for (const side of ['before', 'after'] as const) {
      const colors = heat?.[side];
      this.sides[side]?.model.meshes.forEach((mesh, i) => {
        const values = colors?.[i];
        if (values) writeAttribute(mesh.solid.geometry, 'color', values, side === 'before' ? 4 : 3);
      });
    }
    this.applyLook();
    this.requestRender();
  }

  setLook(look: ModelLook): void {
    this.look = look;
    this.applyLook();
    this.requestRender();
  }

  /**
   * Each side's slots as the Materials look draws them, as their textures decode. Kept when the look is off, so
   * turning it back on shows them at once; a side's go with it when it is replaced.
   */
  setMaterialLooks(looks: Record<Side, ReadonlyMap<string, SlotLook> | null>): void {
    this.materialLooks = looks;
    for (const side of ['before', 'after'] as const) this.sides[side]?.looks.update(looks[side]);
    this.lookTextures.keepOnly(looks);
    this.applyLook();
    this.requestRender();
  }

  /** Dots at these points of each side, in the viewer's space: the nodes picked that have no geometry to light up. */
  setMarkers(markers: Record<Side, Vector[]>): void {
    for (const side of ['before', 'after'] as const) {
      const scene = this.sides[side];
      if (!scene) continue;
      writeAttribute(scene.markers.geometry, 'position', new Float32Array(markers[side].flat()), 3);
    }
    this.requestRender();
  }

  setPalette(palette: ModelPalette): void {
    this.palette = palette;
    this.rebuildGrid();
    this.applyLook();
    this.requestRender();
  }

  /**
   * Sizes the canvas, and draws at once: sizing a canvas clears it, and a draw left for the next frame let the window
   * show it cleared on every step of a resize (the view blinked). Called from a ResizeObserver, which runs after
   * layout and before paint, the new size is painted drawn. The same size again changes nothing: setting a canvas's
   * width, even to the one it has, clears it too.
   */
  setSize(width: number, height: number, pixelRatio: number): void {
    const next = canvasSizeOf(width, height, pixelRatio);
    if (!canvasSizeChanged(this.applied, next)) return;
    this.applied = next;
    this.width = next.width;
    this.height = next.height;
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.targets?.forEach((target) => target.dispose());
    this.targets = null;
    this.renderNow();
  }

  /** The aspect of the pane a version is drawn in: framing fits it. Measured now: a resize may not be told yet. */
  paneAspect(): number {
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth > 0 && clientHeight > 0 && (clientWidth !== this.width || clientHeight !== this.height)) this.setSize(clientWidth, clientHeight, this.pixelRatio);
    const [pane] = this.layout().panes;
    return pane ? pane.viewport.width / pane.viewport.height : this.width / this.height;
  }

  /**
   * What is under a point of the canvas (CSS pixels): the side, the node key of the mesh hit and where, in the
   * viewer's space, and the ray from the camera through it (`pointOnRay`: a zoom where nothing is hit). On the onion
   * skin, the version blended in most.
   */
  pick(x: number, y: number): { side: Side; key: string | null; point: Vector | null; ray: Ray } | null {
    const layout = this.layout();
    let pane = paneAt(layout, x, y, this.height, this.pixelRatio);
    if (layout.blended) pane = layout.panes.find((candidate) => candidate.side === (this.layoutState.blend >= 0.5 ? 'after' : 'before')) ?? null;
    const side = pane && this.sides[pane.side];
    if (!pane || !side) return null;
    const { viewport } = pane;
    const ndc = new Vector2(((x * this.pixelRatio - viewport.x) / viewport.width) * 2 - 1, ((this.height - y) * this.pixelRatio - viewport.y) / viewport.height * 2 - 1);
    this.placeCamera(viewport.width / viewport.height);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const hits: Intersection[] = raycaster.intersectObjects(side.model.meshes.filter((mesh) => mesh.solid.visible || mesh.wire.visible).map((mesh) => mesh.solid), false);
    const [hit] = hits;
    const ray: Ray = { origin: raycaster.ray.origin.toArray(), direction: raycaster.ray.direction.toArray() };
    return { side: pane.side, key: (hit?.object.userData.key as string | undefined) ?? null, point: hit ? (hit.point.toArray() as Vector) : null, ray };
  }

  /**
   * Draws now: for a still (a thumbnail read back at once), and after a resize, whose cleared canvas would otherwise be
   * painted (`setSize`). Everything else draws on the next frame (`requestRender`).
   */
  renderNow(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.render();
  }

  /** Draws on the next frame, once however often it is asked before then. */
  readonly requestRender = (): void => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    for (const side of Object.values(this.sides)) if (side) disposeSide(side);
    this.lookTextures.dispose();
    this.targets?.forEach((target) => target.dispose());
    this.blender.dispose();
    this.environment.dispose();
    disposeGroup(this.grid);
    this.renderer.dispose();
    // The GPU memory goes back at once, not when the canvas is collected: stepping through files makes many viewers.
    this.renderer.forceContextLoss();
  }

  private render(): void {
    if (!this.palette) return;
    const layout = this.layout();
    this.renderer.setClearColor(new Color(this.palette.backdrop));
    if (layout.blended) return this.renderBlended(layout);
    this.renderer.setRenderTarget(null);
    this.renderer.setScissor(0, 0, this.width, this.height);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.renderer.clear();
    for (const pane of layout.panes) {
      const side = this.sides[pane.side];
      if (!side) continue;
      const toCss = (value: number) => value / this.pixelRatio;
      this.renderer.setViewport(toCss(pane.viewport.x), toCss(pane.viewport.y), toCss(pane.viewport.width), toCss(pane.viewport.height));
      this.renderer.setScissor(toCss(pane.scissor.x), toCss(pane.scissor.y), toCss(pane.scissor.width), toCss(pane.scissor.height));
      this.drawSide(side, pane.viewport.width / pane.viewport.height, !pane.overlay);
    }
  }

  private renderBlended(layout: Layout): void {
    const targets = (this.targets ??= [this.target(), this.target()]);
    this.renderer.setScissor(0, 0, this.width, this.height);
    this.renderer.setViewport(0, 0, this.width, this.height);
    // Cleared transparent: the blend tone maps what was drawn and lays it over the backdrop, which is never tone
    // mapped, as when drawing straight to the canvas.
    this.renderer.setClearAlpha(0);
    layout.panes.forEach((pane, i) => {
      this.renderer.setRenderTarget(targets[i]!);
      this.renderer.clear();
      const side = this.sides[pane.side];
      if (side) this.drawSide(side, this.width / this.height);
    });
    this.renderer.setClearAlpha(1);
    this.renderer.setRenderTarget(null);
    this.blender.draw(this.renderer, targets[0]!.texture, targets[1]!.texture, this.layoutState.blend, new Color(this.palette!.backdrop));
  }

  private drawSide(side: SideScene, aspect: number, withGrid = true): void {
    this.placeCamera(aspect);
    // The key light rides over the camera's right shoulder, so the side facing the viewer is always lit.
    const position = new Vector3(...cameraPositionOf(this.view));
    const target = new Vector3(...this.view.target);
    const offset = position.clone().sub(target);
    side.key.position.copy(target).add(offset.applyAxisAngle(new Vector3(0, 1, 0), -0.6).add(new Vector3(0, offset.length() * 0.5, 0)));
    side.key.target.position.copy(target);
    if (withGrid) side.scene.add(this.grid, this.region);
    else this.grid.removeFromParent();
    side.pivot.visible = withGrid;
    this.placeSkeleton(side, withGrid && this.showBones);
    this.renderer.render(side.scene, this.camera);
  }

  /** The skeleton where the bones are now: a take may have moved them since the last frame. */
  private placeSkeleton(side: SideScene, shown: boolean): void {
    side.skeleton.visible = shown && side.model.links.length > 0;
    side.joints.visible = shown && side.model.bones.length > 0;
    if (!shown) return;
    side.scene.updateMatrixWorld();
    const point = new Vector3();
    const lines = new Float32Array(side.model.links.length * 6);
    side.model.links.forEach(([bone, parent], i) => {
      lines.set(point.setFromMatrixPosition(bone.matrixWorld).toArray(), i * 6);
      lines.set(point.setFromMatrixPosition(parent.matrixWorld).toArray(), i * 6 + 3);
    });
    writeAttribute(side.skeleton.geometry, 'position', lines, 3);
    const joints = new Float32Array(side.model.bones.length * 3);
    side.model.bones.forEach((bone, i) => joints.set(point.setFromMatrixPosition(bone.matrixWorld).toArray(), i * 3));
    writeAttribute(side.joints.geometry, 'position', joints, 3);
  }

  private placeCamera(aspect: number): void {
    const { near, far } = clipPlanesOf(this.view, this.bounds);
    this.camera.aspect = aspect;
    this.camera.near = near;
    this.camera.far = far;
    this.camera.position.set(...cameraPositionOf(this.view));
    this.camera.lookAt(...this.view.target);
    this.camera.updateProjectionMatrix();
  }

  private layout(): Layout {
    const { mode, split } = this.layoutState;
    const [width, height] = [this.width * this.pixelRatio, this.height * this.pixelRatio];
    if (!this.sides.before || !this.sides.after) return layoutOf('single', width, height, split, this.sides.after ? 'after' : 'before');
    return layoutOf(mode, width, height, split);
  }

  private target(): WebGLRenderTarget {
    return new WebGLRenderTarget(this.width * this.pixelRatio, this.height * this.pixelRatio, { samples: 4 });
  }

  private sceneOf(model: ModelScene): SideScene {
    const scene = new Scene();
    scene.environment = this.environment;
    scene.environmentIntensity = 0.55;
    const key = new DirectionalLight(0xffffff, 1.8);
    const markers = new Points(new BufferGeometry(), markerMaterial(14));
    markers.renderOrder = 20;
    markers.frustumCulled = false;
    const skeleton = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ depthTest: false, transparent: true, opacity: 0.85 }));
    const joints = new Points(new BufferGeometry(), markerMaterial(7));
    for (const overlay of [skeleton, joints]) {
      overlay.renderOrder = 12;
      overlay.frustumCulled = false;
      overlay.visible = false;
    }
    const pivot = new AxesHelper(1);
    pivot.quaternion.copy(modelOrientation(model));
    (pivot.material as LineBasicMaterial).depthTest = false;
    pivot.renderOrder = 10;
    scene.add(key, key.target, new HemisphereLight(0xffffff, 0x000000, 0.25), model.root, markers, pivot, skeleton, joints);
    const looks = new SlotLookMaterials(model, this.lookTextures);
    return { scene, model, key, markers, pivot, skeleton, joints, looks };
  }

  private applyLook(): void {
    const palette = this.palette;
    if (!palette) return;
    const backdrop = new Color(palette.backdrop);
    const differences = this.layoutState.mode === 'differences' && this.heat !== null && this.sides.before !== null && this.sides.after !== null;
    (this.region.material as LineBasicMaterial).color.set(palette.highlight);
    for (const side of ['before', 'after'] as const) {
      const scene = this.sides[side];
      if (!scene) continue;
      scene.skeleton.material.color.set(palette.bone);
      scene.joints.material.uniforms.fill!.value = new Color(palette.bone);
      scene.joints.material.uniforms.ring!.value = new Color(palette.backdrop);
      scene.markers.material.uniforms.fill!.value = new Color(palette.highlight);
      scene.markers.material.uniforms.ring!.value = new Color(palette.backdrop);
      for (const mesh of scene.model.meshes) {
        mesh.heat.visible = differences && side === 'after';
        mesh.ghost.visible = differences && side === 'before';
      }
      if (differences) {
        // The after's heat in its draw mode's wires; the before only as the ghost of what is gone.
        for (const [index, mesh] of scene.model.meshes.entries()) {
          scene.looks.show(index, false, null);
          mesh.solid.visible = false;
          mesh.wire.visible = side === 'after' && this.look.drawMode !== 'shaded';
          mesh.wire.material.color.set(palette.wire);
          mesh.wire.material.opacity = 0.2;
        }
        continue;
      }
      const highlighted = this.look.highlighted[side];
      const anyHighlighted = this.look.highlighted.before.size + this.look.highlighted.after.size > 0;
      for (const [index, mesh] of scene.model.meshes.entries()) {
        const lit = highlighted.has(mesh.key) || [...highlighted].some((key) => mesh.key.startsWith(`${key}/`));
        const faded = anyHighlighted && !lit;
        const { drawMode, surface } = this.look;
        mesh.solid.visible = drawMode !== 'wireframe';
        mesh.wire.visible = drawMode !== 'shaded' || lit;
        mesh.clay.forEach((material, slot) => {
          const color = new Color(surface === 'slotColors' ? slotColor(palette, mesh.slots[slot] ?? '') : palette.clay);
          material.color.copy(faded ? color.lerp(backdrop, FADE) : color);
          material.emissive.set(lit ? palette.highlight : 0x000000);
          material.emissiveIntensity = lit ? 0.35 : 0;
        });
        scene.looks.show(index, surface === 'materials', { lit, faded, highlight: palette.highlight, backdrop: palette.backdrop, fade: FADE });
        mesh.wire.material.color.set(lit ? palette.highlight : palette.wire);
        mesh.wire.material.opacity = drawMode === 'wireframe' ? 0.9 : lit ? 0.6 : faded ? 0.1 : 0.28;
      }
    }
  }

  /**
   * The ground grid: lines a power of ten apart that suits the model (1 m for a person, as Unity's Scene view
   * shows; 10 cm for a prop held in the hand), every tenth stronger, and X and Z through the origin in Unity's axis
   * colors, so a model off its pivot shows where it went. Each side's pivot axes are sized with it.
   */
  private rebuildGrid(): void {
    const palette = this.palette;
    if (!palette) return;
    disposeGroup(this.grid);
    this.grid.clear();
    const { min, max } = this.bounds;
    const extent = Math.max(max[0] - min[0], max[2] - min[2], max[1] - min[1], 1e-3);
    const cell = 10 ** Math.floor(Math.log10(extent));
    const reach = Math.ceil((Math.max(Math.abs(min[0]), Math.abs(max[0]), Math.abs(min[2]), Math.abs(max[2])) + extent) / cell) * cell;
    const lines = (color: string, every: number, skipEvery: number | null): LineSegments => {
      const positions: number[] = [];
      for (let step = -Math.round(reach / every); step <= Math.round(reach / every); step++) {
        if (step === 0 || (skipEvery !== null && step % skipEvery === 0)) continue;
        const at = step * every;
        positions.push(-reach, 0, at, reach, 0, at, at, 0, -reach, at, 0, reach);
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      return new LineSegments(geometry, new LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    };
    const axis = (color: string, from: Vector, to: Vector): LineSegments => {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute([...from, ...to], 3));
      return new LineSegments(geometry, new LineBasicMaterial({ color, depthWrite: false }));
    };
    this.grid.add(lines(palette.grid, cell, 10), lines(palette.gridMajor, cell * 10, null), axis(palette.axisX, [-reach, 0, 0], [reach, 0, 0]), axis(palette.axisZ, [0, 0, -reach], [0, 0, reach]));
    const pivot = new AxesHelper(extent * 0.12);
    pivot.setColors(new Color(palette.axisX), new Color(palette.axisY), new Color(palette.axisZ));
    (pivot.material as LineBasicMaterial).depthTest = false;
    pivot.renderOrder = 10;
    this.grid.add(pivot);
  }
}

/** Round dots of `size` CSS pixels on screen, ringed in the backdrop's color, never hidden by the model. */
function markerMaterial(size: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { fill: { value: new Color() }, ring: { value: new Color() }, size: { value: size * window.devicePixelRatio } },
    vertexShader: 'uniform float size; void main() { gl_PointSize = size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 fill;
      uniform vec3 ring;
      void main() {
        float distance = length(gl_PointCoord - 0.5) * 2.0;
        if (distance > 1.0) discard;
        gl_FragColor = vec4(distance > 0.62 ? ring : fill, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
}

/** Mixes the two versions drawn apart, tone maps what they drew, lays it over the backdrop and encodes it for the canvas. */
class Blender {
  private readonly material = new ShaderMaterial({
    uniforms: { before: { value: null }, after: { value: null }, blend: { value: 0.5 }, backdrop: { value: new Color() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D before;
      uniform sampler2D after;
      uniform float blend;
      uniform vec3 backdrop;
      varying vec2 vUv;
      void main() {
        // What was drawn comes premultiplied by its coverage (its edges are antialiased over a transparent clear).
        vec4 drawn = mix(texture2D(before, vUv), texture2D(after, vUv), blend);
        gl_FragColor = vec4(drawn.a > 0.0 ? drawn.rgb / drawn.a : vec3(0.0), 1.0);
        #include <tonemapping_fragment>
        gl_FragColor.rgb = mix(backdrop, gl_FragColor.rgb, drawn.a);
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  private readonly quad = new Mesh(new PlaneGeometry(2, 2), this.material);
  private readonly scene = new Scene().add(this.quad);
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  draw(renderer: WebGLRenderer, before: Texture, after: Texture, blend: number, backdrop: Color): void {
    this.material.uniforms.backdrop!.value = backdrop;
    this.material.uniforms.before!.value = before;
    this.material.uniforms.after!.value = after;
    this.material.uniforms.blend!.value = blend;
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}

/**
 * Sets a geometry's attribute to `values`: written into the one it has when that is the same size (a playing take's
 * skeleton each frame, a tolerance's colors each tick), so the GPU buffer is updated rather than made again and the old
 * one left for the collector; a new one otherwise.
 */
function writeAttribute(geometry: BufferGeometry, name: string, values: Float32Array, itemSize: number): void {
  const existing = geometry.getAttribute(name) as Float32BufferAttribute | undefined;
  if (existing && existing.itemSize === itemSize && existing.array.length === values.length) {
    existing.array.set(values);
    existing.needsUpdate = true;
  } else {
    geometry.setAttribute(name, new Float32BufferAttribute(values, itemSize));
  }
  if (name === 'position') geometry.computeBoundingSphere();
}

/** A side's own objects let go: its overlays' geometries and materials (the model's are its scene's to dispose). */
function disposeSide(side: SideScene): void {
  side.model.root.removeFromParent();
  for (const overlay of [side.markers, side.skeleton, side.joints]) {
    overlay.geometry.dispose();
    overlay.material.dispose();
  }
  side.pivot.dispose();
  side.looks.dispose();
}

function disposeGroup(group: Group): void {
  group.traverse((object) => {
    const line = object as Partial<LineSegments>;
    line.geometry?.dispose();
    (line.material as LineBasicMaterial | undefined)?.dispose();
  });
}
