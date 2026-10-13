import { describe, expect, it } from 'vitest';
import { gltfImageBytes, gltfImagePlace, gltfTextureImage } from './gltfJson';

/** A GLB: its JSON chunk (padded with spaces) and its binary chunk (padded with zeros), as glTF lays them out. */
function glb(json: object, binary: Uint8Array): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(text.length / 4) * 4;
  const binaryLength = Math.ceil(binary.length / 4) * 4;
  const bytes = new Uint8Array(12 + 8 + jsonLength + 8 + binaryLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(text, 20);
  view.setUint32(20 + jsonLength, binaryLength, true);
  view.setUint32(24 + jsonLength, 0x004e4942, true);
  bytes.set(binary, 28 + jsonLength);
  return bytes;
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('glTF images', () => {
  it("finds a texture's image, through an image extension too, and where its bytes are", () => {
    const json = { textures: [{ source: 1 }, { extensions: { EXT_texture_webp: { source: 0 } } }], images: [{ uri: 'maps/leaf%20a.webp' }, { bufferView: 0 }, { uri: 'data:image/png;base64,AA==' }] };
    expect([0, 1, 2].map((index) => gltfTextureImage(json, index))).toEqual([1, 0, null]);
    expect([0, 1, 2, 3].map((image) => gltfImagePlace(json, image))).toEqual([{ kind: 'beside', path: 'maps/leaf a.webp' }, { kind: 'inFile' }, { kind: 'inFile' }, null]);
  });

  it("reads an image from a GLB's binary chunk, a data: URI, or a companion buffer, as a view of the bytes", () => {
    const model = glb({ images: [{ bufferView: 0, mimeType: 'image/png' }], bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 7 }], buffers: [{ byteLength: 9 }] }, new Uint8Array([9, 9, ...PNG_BYTES]));
    const read = gltfImageBytes(model, 'glb', 0);
    expect(read && { name: read.name, bytes: [...read.bytes] }).toEqual({ name: 'image.png', bytes: [...PNG_BYTES] });
    expect(read?.bytes.buffer).toBe(model.buffer);

    const inline = new TextEncoder().encode(JSON.stringify({ images: [{ uri: `data:image/jpeg;base64,${btoa('jpeg!')}` }] }));
    expect(gltfImageBytes(inline, 'gltf', 0)?.name).toBe('image.jpg');
    const beside = new TextEncoder().encode(JSON.stringify({ images: [{ bufferView: 0, mimeType: 'image/png' }], bufferViews: [{ buffer: 0, byteLength: 7 }], buffers: [{ uri: 'scene%20data.bin' }] }));
    expect([...gltfImageBytes(beside, 'gltf', 0, { 'scene data.bin': PNG_BYTES })!.bytes]).toEqual([...PNG_BYTES]);
  });

  it('reads nothing past its buffer, for an image in a file of its own, or from a model of another format', () => {
    const model = glb({ images: [{ bufferView: 0 }, { uri: 'leaf.png' }], bufferViews: [{ buffer: 0, byteLength: 4000 }], buffers: [{ byteLength: 4000 }] }, PNG_BYTES);
    expect(gltfImageBytes(model, 'glb', 0)).toBeNull();
    expect(gltfImageBytes(model, 'glb', 1)).toBeNull();
    expect(gltfImageBytes(model, 'fbx', 0)).toBeNull();
  });
});
