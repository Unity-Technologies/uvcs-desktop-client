// The paths an FBX stores for each of its textures: the absolute path on the artist's machine (`FileName`) and the
// path relative to the FBX (`RelativeFilename`). Unity's texture search tries both; three's FBXLoader keeps neither
// (it hands its texture loader the relative path's last part when it was written with backslashes), so they're read
// here, by the Texture object's id, which FBXLoader sets as `texture.ID`. In ASCII FBX a texture is a block
// `Texture: <id>, "Texture::<name>", "" { … FileName: "…" RelativeFilename: "…" }`; in binary FBX a "Texture" record
// under "Objects" whose first property is its id (`L`, int64), with "FileName" and "RelativeFilename" records inside,
// each one `S` string.

import { isBinaryFbx } from './fbxProperties';

export interface FbxTextureFile {
  /** As stored: the artist's absolute path, often of another machine (`C:\Art\bark.png`); '' when absent. */
  fileName: string;
  /** As stored, relative to the FBX (`..\Textures\bark.png`); '' when absent. */
  relativeFileName: string;
}

/** Each texture's stored paths, by its id as FBXLoader reads it. Empty when the bytes can't tell. */
export function readFbxTextureFiles(bytes: Uint8Array): Map<number, FbxTextureFile> {
  try {
    return isBinaryFbx(bytes) ? binaryTextureFiles(bytes) : asciiTextureFiles(new TextDecoder().decode(bytes));
  } catch {
    return new Map();
  }
}

function asciiTextureFiles(text: string): Map<number, FbxTextureFile> {
  const files = new Map<number, FbxTextureFile>();
  const header = /^\s*Texture:\s*(-?\d+)\s*,[^{\n]*\{/gm;
  for (let match = header.exec(text); match; match = header.exec(text)) {
    const body = blockAt(text, header.lastIndex);
    files.set(Number.parseInt(match[1]!, 10), { fileName: asciiString(body, 'FileName'), relativeFileName: asciiString(body, 'RelativeFilename') });
  }
  return files;
}

/** The text of a block from just after its `{` to its matching `}`. */
function blockAt(text: string, start: number): string {
  let depth = 1;
  for (let at = start; at < text.length; at++) {
    if (text[at] === '"') at = text.indexOf('"', at + 1);
    if (at === -1) break;
    if (text[at] === '{') depth++;
    else if (text[at] === '}' && --depth === 0) return text.slice(start, at);
  }
  return text.slice(start);
}

/** A string child of a block, at its own level: `FileName: "C:\Art\bark.png"`. */
function asciiString(body: string, name: string): string {
  const value = new RegExp(`^\\s*${name}:\\s*"([^"]*)"`, 'm').exec(body)?.[1] ?? '';
  return value.replaceAll('&quot;', '"');
}

/** FBX 7.5 and later write a record's offsets and counts as 64-bit numbers. */
const LONG_OFFSETS_FROM = 7500;
const BINARY_HEADER_BYTES = 27;

interface BinaryRecord {
  name: string;
  /** Where its properties start, how long they are, and where its children end. */
  propertiesAt: number;
  propertiesLength: number;
  end: number;
}

function binaryTextureFiles(bytes: Uint8Array): Map<number, FbxTextureFile> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const longOffsets = view.getUint32(23, true) >= LONG_OFFSETS_FROM;
  const files = new Map<number, FbxTextureFile>();
  const objects = records(view, longOffsets, BINARY_HEADER_BYTES, bytes.length).find((record) => record.name === 'Objects');
  if (!objects) return files;
  for (const texture of children(view, longOffsets, objects)) {
    if (texture.name !== 'Texture' || bytes[texture.propertiesAt] !== 0x4c /* L */) continue;
    const id = int64(view, texture.propertiesAt + 1);
    const strings = new Map(children(view, longOffsets, texture).map((child) => [child.name, binaryString(bytes, view, child.propertiesAt)]));
    files.set(id, { fileName: strings.get('FileName') ?? '', relativeFileName: strings.get('RelativeFilename') ?? '' });
  }
  return files;
}

function children(view: DataView, longOffsets: boolean, parent: BinaryRecord): BinaryRecord[] {
  return records(view, longOffsets, parent.propertiesAt + parent.propertiesLength, parent.end);
}

/** The records from `start` until a null record (all zeros) or `end`. */
function records(view: DataView, longOffsets: boolean, start: number, end: number): BinaryRecord[] {
  const found: BinaryRecord[] = [];
  const size = longOffsets ? 8 : 4;
  const read = (at: number): number => (longOffsets ? Number(view.getBigUint64(at, true)) : view.getUint32(at, true));
  for (let at = start; at + size * 3 + 1 <= end; ) {
    const recordEnd = read(at);
    if (recordEnd === 0 || recordEnd > end || recordEnd <= at) break;
    const nameLength = view.getUint8(at + size * 3);
    const nameAt = at + size * 3 + 1;
    const name = String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + nameAt, nameLength));
    found.push({ name, propertiesAt: nameAt + nameLength, propertiesLength: read(at + size * 2), end: recordEnd });
    at = recordEnd;
  }
  return found;
}

/** An `S` property: a uint32 length and its bytes. */
function binaryString(bytes: Uint8Array, view: DataView, at: number): string {
  if (bytes[at] !== 0x53 /* S */) return '';
  const length = view.getUint32(at + 1, true);
  return new TextDecoder().decode(bytes.subarray(at + 5, at + 5 + length));
}

/**
 * An int64 computed exactly as FBXLoader (three 0.186) computes one, its 32-bit masks and all, so ids past 2^53 or
 * negative still match the `texture.ID` it sets.
 */
function int64(view: DataView, at: number): number {
  let low = view.getUint32(at, true);
  let high = view.getUint32(at + 4, true);
  if (!(high & 0x80000000)) return high * 0x100000000 + low;
  high = ~high & 0xffffffff;
  low = ~low & 0xffffffff;
  if (low === 0xffffffff) high = (high + 1) & 0xffffffff;
  low = (low + 1) & 0xffffffff;
  return -(high * 0x100000000 + low);
}
