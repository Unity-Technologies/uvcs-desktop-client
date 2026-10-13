// Writes ASCII FBX 7.4, as the DCC tools export it, for tests and the models sandbox (`scripts/sandboxes/models.sh`):
// a hierarchy of meshes, empties and bones with their transforms, each mesh's material slots per polygon and its UVs
// and the bone it is skinned to,
// the materials' colors and the texture files they name, animation takes, and the global settings (up axis, units,
// the exporting app). Only what the diff reads; never shipped in the app.

export interface FbxScene {
  /** 1: Y-up (Maya), 2: Z-up (Blender's own axes, 3ds Max). */
  upAxis?: 1 | 2;
  /** Centimetres per file unit: 1 (cm, Maya's default), 100 (metres). */
  unitScaleFactor?: number;
  application?: { name: string; version: string };
  nodes: FbxNodeSpec[];
  /** Animation takes ("AnimStack"s), which Unity imports as clips: Maya names its one take "Take 001". */
  takes?: FbxTake[];
  /** What a material slot's material sets, by its name; a slot without one is a plain Phong material. */
  materials?: Record<string, FbxMaterialSpec>;
}

export interface FbxMaterialSpec {
  /** sRGB, as DCC tools write `DiffuseColor`. */
  diffuse?: [number, number, number];
  opacity?: number;
  diffuseTexture?: FbxTextureSpec;
  normalTexture?: FbxTextureSpec;
}

/** A texture file as an exporter names it: the path on the artist's machine, and relative to the FBX. */
export interface FbxTextureSpec {
  fileName: string;
  relativeFileName?: string;
}

export interface FbxTake {
  name: string;
  /** Where the take stops, in seconds: Unity's clip splits count their frames within it. */
  length: number;
  curves: FbxCurve[];
}

/** One node's transform property keyed over time, a value per axis at each key. */
export interface FbxCurve {
  node: string;
  property: 'translation' | 'rotation' | 'scale';
  /** In seconds. */
  times: number[];
  /** Per key; rotations in degrees, as FBX stores them. */
  values: [number, number, number][];
}

export interface FbxNodeSpec {
  name: string;
  /** A mesh, an empty ("Null") or a bone ("LimbNode"). */
  kind: 'mesh' | 'group' | 'bone';
  /** The parent's name; the scene's root when absent. */
  parent?: string;
  translation?: [number, number, number];
  /** Euler XYZ, in degrees, as FBX stores it. */
  rotation?: [number, number, number];
  scale?: [number, number, number];
  mesh?: FbxMeshSpec;
}

export interface FbxMeshSpec {
  vertices: number[];
  /** Each polygon's vertex indices (triangles or quads). */
  polygons: number[][];
  /** Material slot names, in slot order. */
  materials: string[];
  /** Each polygon's slot; all slot 0 when absent. */
  polygonMaterials?: number[];
  /** Planar UVs from X and Y, one per polygon corner. */
  uvs?: boolean;
  /** Every vertex skinned wholly to one bone, as a Skin deformer with one Cluster. */
  skin?: FbxSkinSpec;
}

export interface FbxSkinSpec {
  bone: string;
  /** The bone's world matrix when the mesh was bound (the cluster's `TransformLink`), column-major. */
  transformLink: number[];
}

export function asciiFbx(scene: FbxScene): string {
  const ids = new Map<string, number>();
  scene.nodes.forEach((node, i) => ids.set(node.name, 100000 + i * 10));
  const objects: string[] = [];
  const connections: string[] = [];
  const materialIds = new Map<string, number>();

  for (const node of scene.nodes) {
    const id = ids.get(node.name)!;
    objects.push(model(id, node));
    const parent = node.parent === undefined ? 0 : ids.get(node.parent);
    if (parent === undefined) throw new Error(`No node named ${node.parent}`);
    connections.push(`\tC: "OO",${id},${parent}`);
    if (node.mesh) {
      objects.push(geometry(id + 1, node.name, node.mesh));
      connections.push(`\tC: "OO",${id + 1},${id}`);
      for (const material of node.mesh.materials) {
        if (!materialIds.has(material)) {
          const materialId = 900000 + materialIds.size * 10;
          materialIds.set(material, materialId);
          const written = materialObjects(materialId, material, scene.materials?.[material] ?? {});
          objects.push(...written.objects);
          connections.push(...written.connections);
        }
        connections.push(`\tC: "OO",${materialIds.get(material)},${id}`);
      }
      if (node.mesh.skin) {
        const written = skinObjects(id + 2, id + 1, node.mesh, ids);
        objects.push(...written.objects);
        connections.push(...written.connections);
      }
    }
  }

  (scene.takes ?? []).forEach((take, i) => {
    const written = takeObjects(take, 500000 + i * 10000, ids);
    objects.push(...written.objects);
    connections.push(...written.connections);
  });

  return [
    '; FBX 7.4.0 project file',
    'FBXHeaderExtension:  {',
    '\tFBXHeaderVersion: 1003',
    '\tFBXVersion: 7400',
    '}',
    'GlobalSettings:  {',
    '\tVersion: 1000',
    '\tProperties70:  {',
    `\t\tP: "UpAxis", "int", "Integer", "",${scene.upAxis ?? 1}`,
    `\t\tP: "UnitScaleFactor", "double", "Number", "",${scene.unitScaleFactor ?? 100}`,
    '\t}',
    '}',
    ...(scene.application ? sceneInfo(scene.application) : []),
    'Objects:  {',
    ...objects,
    '}',
    'Connections:  {',
    ...connections,
    '}',
    '',
  ].join('\n');
}

function sceneInfo(application: { name: string; version: string }): string[] {
  return [
    'Documents:  {',
    '\tDocument: 1, "Scene", "Scene" {',
    '\t\tProperties70:  {',
    `\t\t\tP: "Original|ApplicationName", "KString", "", "", "${application.name}"`,
    `\t\t\tP: "Original|ApplicationVersion", "KString", "", "", "${application.version}"`,
    '\t\t}',
    '\t}',
    '}',
  ];
}

/** FBX counts time in ticks: 46,186,158,000 a second. */
const FBX_TICKS_PER_SECOND = 46186158000;
const CURVE_NODE_ATTRIBUTES = { translation: 'T', rotation: 'R', scale: 'S' } as const;
const CURVE_NODE_PROPERTIES = { translation: 'Lcl Translation', rotation: 'Lcl Rotation', scale: 'Lcl Scaling' } as const;

/** A take as FBX nests it: the stack, its one layer, a curve node per animated property, a curve per axis. */
function takeObjects(take: FbxTake, firstId: number, nodeIds: Map<string, number>): { objects: string[]; connections: string[] } {
  const ticks = (seconds: number): number => Math.round(seconds * FBX_TICKS_PER_SECOND);
  const stackId = firstId;
  const layerId = firstId + 1;
  const objects = [
    `\tAnimationStack: ${stackId}, "AnimStack::${take.name}", "" {`,
    '\t\tProperties70:  {',
    `\t\t\tP: "LocalStop", "KTime", "Time", "",${ticks(take.length)}`,
    '\t\t}',
    '\t}',
    `\tAnimationLayer: ${layerId}, "AnimLayer::BaseLayer", "" {`,
    '\t}',
  ];
  const connections = [`\tC: "OO",${layerId},${stackId}`];
  take.curves.forEach((curve, i) => {
    const model = nodeIds.get(curve.node);
    if (model === undefined) throw new Error(`No node named ${curve.node}`);
    const curveNodeId = firstId + 10 + i * 4;
    const first = curve.values[0] ?? [0, 0, 0];
    objects.push(
      `\tAnimationCurveNode: ${curveNodeId}, "AnimCurveNode::${CURVE_NODE_ATTRIBUTES[curve.property]}", "" {`,
      '\t\tProperties70:  {',
      ...['X', 'Y', 'Z'].map((axis, a) => `\t\t\tP: "d|${axis}", "Number", "", "A",${first[a]}`),
      '\t\t}',
      '\t}',
    );
    connections.push(`\tC: "OO",${curveNodeId},${layerId}`, `\tC: "OP",${curveNodeId},${model}, "${CURVE_NODE_PROPERTIES[curve.property]}"`);
    ['X', 'Y', 'Z'].forEach((axis, a) => {
      const curveId = curveNodeId + 1 + a;
      objects.push(
        `\tAnimationCurve: ${curveId}, "AnimCurve::", "" {`,
        '\t\tKeyVer: 4009',
        array('KeyTime', curve.times.map(ticks)),
        array('KeyValueFloat', curve.values.map((value) => value[a]!)),
        '\t}',
      );
      connections.push(`\tC: "OP",${curveId},${curveNodeId}, "d|${axis}"`);
    });
  });
  return { objects, connections };
}

/** A material with its colors, and each texture as FBX nests it: a Texture object over a Video (the image file). */
function materialObjects(id: number, name: string, spec: FbxMaterialSpec): { objects: string[]; connections: string[] } {
  const properties = [
    spec.diffuse && `\t\t\tP: "DiffuseColor", "Color", "", "A",${spec.diffuse.join(',')}`,
    spec.opacity !== undefined && `\t\t\tP: "Opacity", "double", "Number", "",${spec.opacity}`,
  ].filter((line): line is string => typeof line === 'string');
  const objects = [`\tMaterial: ${id}, "Material::${name}", "" {`, '\t\tVersion: 102', '\t\tShadingModel: "phong"', '\t\tProperties70:  {', ...properties, '\t\t}', '\t}'];
  const connections: string[] = [];
  const textures: [FbxTextureSpec | undefined, string][] = [
    [spec.diffuseTexture, 'DiffuseColor'],
    [spec.normalTexture, 'NormalMap'],
  ];
  textures.forEach(([texture, property], i) => {
    if (!texture) return;
    const textureId = id + 1 + i * 2;
    const videoId = textureId + 1;
    const fileName = texture.fileName.split(/[\\/]/).pop()!;
    const files = [`\t\tFileName: "${texture.fileName}"`, `\t\tRelativeFilename: "${texture.relativeFileName ?? ''}"`];
    objects.push(
      `\tVideo: ${videoId}, "Video::${fileName}", "Clip" {`,
      '\t\tType: "Clip"',
      ...files.map((line) => line.replace('FileName', 'Filename')),
      '\t}',
      `\tTexture: ${textureId}, "Texture::${fileName}", "" {`,
      '\t\tType: "TextureVideoClip"',
      '\t\tVersion: 202',
      `\t\tTextureName: "Texture::${fileName}"`,
      `\t\tMedia: "Video::${fileName}"`,
      ...files,
      '\t}',
    );
    connections.push(`\tC: "OO",${videoId},${textureId}`, `\tC: "OP",${textureId},${id}, "${property}"`);
  });
  return { objects, connections };
}

/** A Skin deformer on the geometry, and its one Cluster holding every vertex on the bone. */
function skinObjects(skinId: number, geometryId: number, mesh: FbxMeshSpec, nodeIds: Map<string, number>): { objects: string[]; connections: string[] } {
  const { bone, transformLink } = mesh.skin!;
  const boneId = nodeIds.get(bone);
  if (boneId === undefined) throw new Error(`No node named ${bone}`);
  const clusterId = skinId + 1;
  const vertices = Array.from({ length: mesh.vertices.length / 3 }, (_, i) => i);
  const objects = [
    `\tDeformer: ${skinId}, "Deformer::", "Skin" {`,
    '\t\tVersion: 101',
    '\t}',
    `\tDeformer: ${clusterId}, "SubDeformer::", "Cluster" {`,
    '\t\tVersion: 100',
    array('Indexes', vertices),
    array('Weights', vertices.map(() => 1)),
    // Exporters write the mesh's world at bind here; FBXLoader (three 0.186) doesn't read it, binding at the mesh's
    // world as loaded, so the identity stands in.
    array('Transform', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    array('TransformLink', transformLink),
    '\t}',
  ];
  const connections = [`\tC: "OO",${skinId},${geometryId}`, `\tC: "OO",${clusterId},${skinId}`, `\tC: "OO",${boneId},${clusterId}`];
  return { objects, connections };
}

const FBX_TYPES = { mesh: 'Mesh', group: 'Null', bone: 'LimbNode' } as const;

function model(id: number, node: FbxNodeSpec): string {
  const properties = [
    node.translation && `\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",${node.translation.join(',')}`,
    node.rotation && `\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",${node.rotation.join(',')}`,
    node.scale && `\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",${node.scale.join(',')}`,
  ].filter(Boolean);
  return [`\tModel: ${id}, "Model::${node.name}", "${FBX_TYPES[node.kind]}" {`, '\t\tVersion: 232', '\t\tProperties70:  {', ...properties, '\t\t}', '\t}'].join('\n');
}

function geometry(id: number, name: string, mesh: FbxMeshSpec): string {
  // FBX ends each polygon with its last index negated, minus one.
  const indices = mesh.polygons.flatMap((polygon) => polygon.map((index, i) => (i === polygon.length - 1 ? -index - 1 : index)));
  const slots = mesh.polygonMaterials ?? mesh.polygons.map(() => 0);
  const lines = [
    `\tGeometry: ${id}, "Geometry::${name}", "Mesh" {`,
    array('Vertices', mesh.vertices),
    array('PolygonVertexIndex', indices),
    '\t\tGeometryVersion: 124',
    '\t\tLayerElementMaterial: 0 {',
    '\t\t\tVersion: 101',
    '\t\t\tMappingInformationType: "ByPolygon"',
    '\t\t\tReferenceInformationType: "IndexToDirect"',
    array('Materials', slots, '\t\t\t'),
    '\t\t}',
  ];
  if (mesh.uvs) {
    const uvs = mesh.polygons.flatMap((polygon) => polygon.flatMap((index) => [mesh.vertices[index * 3]!, mesh.vertices[index * 3 + 1]!]));
    lines.push(
      '\t\tLayerElementUV: 0 {',
      '\t\t\tVersion: 101',
      '\t\t\tName: "UVMap"',
      '\t\t\tMappingInformationType: "ByPolygonVertex"',
      '\t\t\tReferenceInformationType: "Direct"',
      array('UV', uvs, '\t\t\t'),
      '\t\t}',
    );
  }
  lines.push('\t\tLayer: 0 {', '\t\t\tVersion: 100', '\t\t\tLayerElement:  {', '\t\t\t\tType: "LayerElementMaterial"', '\t\t\t\tTypedIndex: 0', '\t\t\t}');
  if (mesh.uvs) lines.push('\t\t\tLayerElement:  {', '\t\t\t\tType: "LayerElementUV"', '\t\t\t\tTypedIndex: 0', '\t\t\t}');
  lines.push('\t\t}', '\t}');
  return lines.join('\n');
}

function array(name: string, values: number[], indent = '\t\t'): string {
  return `${indent}${name}: *${values.length} {\n${indent}\ta: ${values.join(',')}\n${indent}}`;
}

/** A box's eight corners and six quads, centered on `center`. */
export function box(size: [number, number, number], center: [number, number, number] = [0, 0, 0]): Pick<FbxMeshSpec, 'vertices' | 'polygons'> {
  const [sx, sy, sz] = size.map((value) => value / 2) as [number, number, number];
  const [cx, cy, cz] = center;
  const vertices: number[] = [];
  for (const z of [-sz, sz]) for (const y of [-sy, sy]) for (const x of [-sx, sx]) vertices.push(cx + x, cy + y, cz + z);
  const polygons = [
    [0, 2, 3, 1],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 6, 7, 3],
    [0, 4, 6, 2],
    [1, 3, 7, 5],
  ];
  return { vertices, polygons };
}

/** A UV sphere of `rings` × `segments` quads (triangles at the poles), its vertices pushed out by `displace`. */
export function sphere(
  radius: number,
  rings: number,
  segments: number,
  displace: (x: number, y: number, z: number) => number = () => 0,
): Pick<FbxMeshSpec, 'vertices' | 'polygons'> {
  const vertices: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const polar = (ring / rings) * Math.PI;
    for (let segment = 0; segment < segments; segment++) {
      const azimuth = (segment / segments) * Math.PI * 2;
      const x = Math.sin(polar) * Math.cos(azimuth);
      const y = Math.cos(polar);
      const z = Math.sin(polar) * Math.sin(azimuth);
      const r = radius + displace(x, y, z);
      vertices.push(x * r, y * r, z * r);
    }
  }
  const at = (ring: number, segment: number): number => ring * segments + (segment % segments);
  const polygons: number[][] = [];
  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      polygons.push([at(ring, segment), at(ring, segment + 1), at(ring + 1, segment + 1), at(ring + 1, segment)]);
    }
  }
  return { vertices, polygons };
}
