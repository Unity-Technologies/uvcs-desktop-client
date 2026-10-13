import { describe, expect, it } from 'vitest';
import { readFbxTextureFiles } from './fbxTextureFiles';
import { asciiFbx, box } from './testing/asciiFbx';

describe('readFbxTextureFiles, ASCII', () => {
  it("reads each texture's stored paths by its id, as an exporter writes them", () => {
    const fbx = asciiFbx({
      nodes: [{ name: 'Tree', kind: 'mesh', mesh: { ...box([1, 1, 1]), materials: ['Bark', 'Leaves'], uvs: true } }],
      materials: {
        Bark: { diffuseTexture: { fileName: 'C:\\Art\\Tree\\bark.png', relativeFileName: '..\\Textures\\bark.png' }, normalTexture: { fileName: '/Users/ana/Tree/bark_n.png' } },
      },
    });
    const files = [...readFbxTextureFiles(new TextEncoder().encode(fbx)).values()];
    expect(files).toEqual([
      { fileName: 'C:\\Art\\Tree\\bark.png', relativeFileName: '..\\Textures\\bark.png' },
      { fileName: '/Users/ana/Tree/bark_n.png', relativeFileName: '' },
    ]);
  });

  it('reads nothing from a file without textures, or bytes that are no FBX', () => {
    expect(readFbxTextureFiles(new TextEncoder().encode(asciiFbx({ nodes: [{ name: 'Rock', kind: 'mesh', mesh: { ...box([1, 1, 1]), materials: ['Rock'] } }] }))).size).toBe(0);
    expect(readFbxTextureFiles(new Uint8Array([1, 2, 3])).size).toBe(0);
  });
});

/** A binary FBX record: its properties (`L` int64 or `S` string) and the records inside it. */
interface Record {
  name: string;
  properties: (bigint | string)[];
  children?: Record[];
}

/** A binary FBX of these top-level records, as FBX 7.4 (32-bit offsets) or 7.5 (64-bit) writes them. */
function binaryFbx(version: 7400 | 7500, records: Record[]): Uint8Array {
  const size = version >= 7500 ? 8 : 4;
  const header = new Uint8Array(27);
  header.set(new TextEncoder().encode('Kaydara FBX Binary  \0\x1a\0'));
  new DataView(header.buffer).setUint32(23, version, true);
  const parts: Uint8Array[] = [header];
  let offset = header.length;
  const push = (part: Uint8Array): void => {
    parts.push(part);
    offset += part.length;
  };
  const number = (value: number): Uint8Array => {
    const bytes = new Uint8Array(size);
    if (size === 8) new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
    else new DataView(bytes.buffer).setUint32(0, value, true);
    return bytes;
  };
  const property = (value: bigint | string): Uint8Array => {
    if (typeof value === 'bigint') {
      const bytes = new Uint8Array(9);
      bytes[0] = 0x4c;
      new DataView(bytes.buffer).setBigInt64(1, value, true);
      return bytes;
    }
    const text = new TextEncoder().encode(value);
    const bytes = new Uint8Array(5 + text.length);
    bytes[0] = 0x53;
    new DataView(bytes.buffer).setUint32(1, text.length, true);
    bytes.set(text, 5);
    return bytes;
  };
  const write = (record: Record): void => {
    const properties = record.properties.map(property);
    const propertiesLength = properties.reduce((sum, part) => sum + part.length, 0);
    const name = new TextEncoder().encode(record.name);
    const endAt = new Uint8Array(size);
    push(endAt);
    push(number(properties.length));
    push(number(propertiesLength));
    push(new Uint8Array([name.length]));
    push(name);
    properties.forEach(push);
    if (record.children) {
      record.children.forEach(write);
      push(new Uint8Array(size * 3 + 1));
    }
    endAt.set(number(offset));
  };
  records.forEach(write);
  push(new Uint8Array(size * 3 + 1));
  const bytes = new Uint8Array(offset);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }
  return bytes;
}

const texture = (id: bigint, fileName: string, relativeFileName: string): Record => ({
  name: 'Texture',
  properties: [id, 'bark\0\x01Texture', ''],
  children: [
    { name: 'Type', properties: ['TextureVideoClip'] },
    { name: 'FileName', properties: [fileName] },
    { name: 'RelativeFilename', properties: [relativeFileName] },
  ],
});

describe('readFbxTextureFiles, binary', () => {
  it.each([7400, 7500] as const)("reads each texture's stored paths by its id in FBX %i", (version) => {
    const fbx = binaryFbx(version, [
      { name: 'FBXHeaderExtension', properties: [], children: [{ name: 'FBXVersion', properties: [String(version)] }] },
      { name: 'Objects', properties: [], children: [{ name: 'Material', properties: [10n, 'Bark\0\x01Material', ''] }, texture(2280839011952n, 'D:\\Proj\\bark.tga', 'Textures\\bark.tga')] },
    ]);
    expect(readFbxTextureFiles(fbx)).toEqual(new Map([[2280839011952, { fileName: 'D:\\Proj\\bark.tga', relativeFileName: 'Textures\\bark.tga' }]]));
  });

  it('keys a negative id as FBXLoader reads it', () => {
    const fbx = binaryFbx(7400, [{ name: 'Objects', properties: [], children: [texture(-5n, 'a.png', '')] }]);
    expect([...readFbxTextureFiles(fbx).keys()]).toEqual([-5]);
  });

  it('reads nothing from a truncated file', () => {
    const fbx = binaryFbx(7400, [{ name: 'Objects', properties: [], children: [texture(7n, 'a.png', '')] }]);
    expect(readFbxTextureFiles(fbx.subarray(0, 60)).size).toBe(0);
  });
});
