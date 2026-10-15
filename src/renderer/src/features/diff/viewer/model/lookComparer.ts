// Diffs by look: both versions drawn apart with their materials, through one camera, compared pixel by pixel on the
// GPU as the image diff compares two images (`comparePixels`): what is seen, tone mapped and over the backdrop, its
// largest channel difference in sRGB, or the coverage's if larger, so a part only one version has is the largest change.
// What changed shows in the accent, as opaque as the change is large; what didn't, as a gray ghost of the version after.
// One rule covers a texture swapped or repainted, a color, tiling, a normal map, a material remapped and a shape moved.

import { Color, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, type Texture, type WebGLRenderer } from 'three';

/**
 * Changes this small (of 255, as the image diff's tolerance) don't count: the two draws are the same pipeline, so an
 * unchanged surface differs by nothing; this only keeps a rounding step of the GPU's from lighting up.
 */
const LOOK_TOLERANCE = 4;
/** A changed pixel's accent starts this opaque, as the image diff's (`MIN_ACCENT_ALPHA`), so a small change still shows. */
const MIN_ACCENT = 140 / 255;
/** How much of the version after's gray shows over the backdrop where nothing changed: its form, without drawing the eye. */
const GHOST = 0.5;

export class LookComparer {
  private readonly material = new ShaderMaterial({
    uniforms: {
      before: { value: null },
      after: { value: null },
      backdrop: { value: new Color() },
      accent: { value: new Color() },
      tolerance: { value: LOOK_TOLERANCE / 255 },
      minAccent: { value: MIN_ACCENT },
      ghost: { value: GHOST },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D before;
      uniform sampler2D after;
      uniform vec3 backdrop;
      uniform vec3 accent;
      uniform float tolerance;
      uniform float minAccent;
      uniform float ghost;
      varying vec2 vUv;

      // What was drawn comes premultiplied by its coverage (its edges are antialiased over a transparent clear), and
      // not yet tone mapped: drawn to the canvas, it would be (the onion's \`Blender\` does the same).
      vec3 seen(vec4 drawn) {
        vec3 color = drawn.a > 0.0 ? drawn.rgb / drawn.a : vec3(0.0);
        #ifdef TONE_MAPPING
          color = toneMapping(color);
        #endif
        return mix(backdrop, color, drawn.a);
      }

      void main() {
        vec4 was = texture2D(before, vUv);
        vec4 now = texture2D(after, vUv);
        float covered = max(was.a, now.a);
        if (covered <= 0.0) discard;
        vec3 wasSeen = seen(was);
        vec3 nowSeen = seen(now);
        vec3 change = abs(sRGBTransferOETF(vec4(wasSeen, 1.0)).rgb - sRGBTransferOETF(vec4(nowSeen, 1.0)).rgb);
        float difference = max(max(change.r, change.g), max(change.b, abs(was.a - now.a)));
        float gray = dot(now.a > 0.0 ? nowSeen : wasSeen, vec3(0.2126, 0.7152, 0.0722));
        vec3 shown = mix(backdrop, vec3(gray), ghost);
        // The accent shaded by the surface's own light, so a surface that changed whole still shows its form and
        // what it looks like now, not a flat silhouette.
        vec3 shaded = accent * mix(0.35, 1.3, sqrt(gray));
        if (difference > tolerance) shown = mix(shown, shaded, minAccent + difference * (1.0 - minAccent));
        // Opaque: \`seen\` already laid a partly covered edge over the backdrop; blending it again would rim it.
        gl_FragColor = vec4(shown, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  private readonly quad = new Mesh(new PlaneGeometry(2, 2), this.material);
  private readonly scene = new Scene().add(this.quad);
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /** Lays the comparison over what the canvas holds (the backdrop and the grid), where either version covers it. */
  draw(renderer: WebGLRenderer, before: Texture, after: Texture, colors: { backdrop: string; accent: string }): void {
    this.material.uniforms.before!.value = before;
    this.material.uniforms.after!.value = after;
    (this.material.uniforms.backdrop!.value as Color).set(colors.backdrop);
    (this.material.uniforms.accent!.value as Color).set(colors.accent);
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
