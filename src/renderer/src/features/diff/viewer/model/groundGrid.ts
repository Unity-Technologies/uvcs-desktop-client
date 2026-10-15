// The ground grid, as Unity's Scene view and Blender draw theirs: endless, on the floor the contact shadow lies on
// (`shadowFrameOf`), its cells a power of ten that suits how far each part of it is (10 cm near the camera, 1 m
// farther, 10 m towards the horizon, each fading into the next), fading out with the distance from the camera. X and
// Z through the origin in Unity's axis colors say where the pivot is across the ground. It is worked out per pixel on
// the GPU over the whole view: where the camera's ray through the pixel meets the floor, the lines there. Started at
// the camera, never at the near plane, it is never cut: lines laid out as geometry were cut between the camera and the
// model by the near plane, which is as far out as the model allows for the Differences mode's depth precision
// (`clipPlanesOf`), and a grid of geometry sized to the model ended in an edge or left the view empty. Each pixel writes
// the depth the model's camera gives the floor there (`gl_FragDepth`), so the model hides the grid behind it.

import { Color, Matrix4, Mesh, PlaneGeometry, type PerspectiveCamera, ShaderMaterial } from 'three';

/** The fewest pixels between two lines drawn whole: closer, they fade out into the cells ten times larger. */
export const MIN_PIXELS_BETWEEN_LINES = 60;
/** How far from the camera the grid has faded out, in camera distances to what it looks at. */
export const FADE_DISTANCES = 5;
/** How opaque the lines are at most. */
const OPACITY = 0.9;
/** How opaque the smallest cells' lines are, against the others: a hint of the finer scale, never a mesh. */
const SMALL_OPACITY = 0.5;
/** How many pixels across the X and Z axes' lines fade out: under one, they read as thin as the grid's. */
const AXIS_PIXELS = 0.7;
/** How opaque the X and Z axes are: muted, as Unity's and Blender's, so they say where the pivot is without leading the eye. */
const AXIS_OPACITY = 0.55;

/** Where the grid has faded out: `FADE_DISTANCES` the camera's distance to its target, so zooming out shows more ground. */
export function gridFadeDistanceOf(cameraDistance: number): number {
  return Math.max(cameraDistance, 1e-6) * FADE_DISTANCES;
}

export interface GroundGridColors {
  minor: string;
  major: string;
  axisX: string;
  axisZ: string;
}

export class GroundGrid {
  /** A quad over the whole view: its vertices are in clip space, whatever the camera. */
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly uniforms = {
    inverseViewProjection: { value: new Matrix4() },
    viewProjection: { value: new Matrix4() },
    floorY: { value: 0 },
    fadeDistance: { value: 1 },
    opacity: { value: OPACITY },
    minorColor: { value: new Color() },
    majorColor: { value: new Color() },
    axisXColor: { value: new Color() },
    axisZColor: { value: new Color() },
  };

  constructor(colors: GroundGridColors, floor: number) {
    this.uniforms.floorY.value = floor;
    this.uniforms.minorColor.value.set(colors.minor);
    this.uniforms.majorColor.value.set(colors.major);
    this.uniforms.axisXColor.value.set(colors.axisX);
    this.uniforms.axisZColor.value.set(colors.axisZ);
    const material = new ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
  }

  /** Follows the camera about to draw: called after it is placed, for each pane (each has its own aspect). */
  follow(camera: PerspectiveCamera, cameraDistance: number): void {
    camera.updateMatrixWorld();
    this.uniforms.viewProjection.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.uniforms.inverseViewProjection.value.copy(this.uniforms.viewProjection.value).invert();
    this.uniforms.fadeDistance.value = gridFadeDistanceOf(cameraDistance);
  }
}

const VERTEX = `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// The levels of lines crossfade as Unity's grid does: the smallest cells, whose lines are fewer than MIN_PIXELS apart,
// fade out as they close in; the next ten times larger turn from the major color to the minor one, and from whole to
// the smallest's strength; the next are major. Where the level a pixel draws steps, every line keeps its color and
// strength, so none is cut or fades along its length.
const FRAGMENT = `
  uniform mat4 inverseViewProjection;
  uniform mat4 viewProjection;
  uniform float floorY;
  uniform float fadeDistance;
  uniform float opacity;
  uniform vec3 minorColor;
  uniform vec3 majorColor;
  uniform vec3 axisXColor;
  uniform vec3 axisZColor;
  varying vec2 vNdc;

  float onLines(vec2 place, vec2 perPixel, float cell) {
    vec2 away = abs(mod(place + 0.5 * cell, cell) - 0.5 * cell) / perPixel;
    return 1.0 - clamp(min(away.x, away.y), 0.0, 1.0);
  }

  void main() {
    vec4 farPoint = inverseViewProjection * vec4(vNdc, 1.0, 1.0);
    vec3 ray = farPoint.xyz / farPoint.w - cameraPosition;
    float along = (floorY - cameraPosition.y) / (abs(ray.y) < 1e-9 ? 1e-9 : ray.y);
    vec3 world = cameraPosition + ray * along;
    vec2 place = world.xz;
    // Derivatives before any discard: a pixel's neighbours need them too.
    vec2 perPixel = max(fwidth(place), vec2(1e-7));
    float level = log(max(perPixel.x, perPixel.y) * ${MIN_PIXELS_BETWEEN_LINES.toFixed(1)}) / log(10.0);
    float closing = fract(level);
    float cell = pow(10.0, floor(level));
    // Each level's strength goes on where the next takes over: the smallest fade from SMALL_OPACITY out as they close
    // in, and the next ten times larger come in at it and grow whole, so no line changes strength along its length
    // where the level a pixel draws steps.
    float small = onLines(place, perPixel, cell) * (1.0 - closing) * ${SMALL_OPACITY.toFixed(2)};
    float minor = onLines(place, perPixel, cell * 10.0) * mix(${SMALL_OPACITY.toFixed(2)}, 1.0, 1.0 - closing);
    float major = onLines(place, perPixel, cell * 100.0);
    vec3 color = minorColor;
    float alpha = small;
    if (minor > 0.0) { color = mix(majorColor, minorColor, closing); alpha = minor; }
    if (major > 0.0) { color = majorColor; alpha = major; }
    float axisX = 1.0 - clamp(abs(place.y) / (perPixel.y * ${AXIS_PIXELS.toFixed(2)}), 0.0, 1.0);
    if (axisX > 0.0) { color = axisXColor; alpha = max(alpha, axisX * ${AXIS_OPACITY.toFixed(2)}); }
    float axisZ = 1.0 - clamp(abs(place.x) / (perPixel.x * ${AXIS_PIXELS.toFixed(2)}), 0.0, 1.0);
    if (axisZ > 0.0) { color = axisZColor; alpha = max(alpha, axisZ * ${AXIS_OPACITY.toFixed(2)}); }
    alpha *= opacity * (1.0 - smoothstep(fadeDistance * 0.4, fadeDistance, distance(world, cameraPosition)));
    // Behind the camera (the floor above it while it looks down, or below it while it looks up), or nothing to draw.
    if (along <= 0.0 || alpha <= 0.002) discard;
    vec4 clip = viewProjection * vec4(world, 1.0);
    gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
