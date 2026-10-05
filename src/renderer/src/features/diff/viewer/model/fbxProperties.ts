// An FBX's global settings and scene info, read from its bytes. three's FBXLoader keeps none of what the diff tells
// (the up axis it turns a Z-up file by, the app that exported it), so they're read here: in ASCII FBX a property is a
// line `P: "UpAxis", "int", "Integer", "",2`; in binary FBX a "P" record whose first value is the name as an
// `S` string (a type byte, a uint32 length, the bytes), then its type, its kind and its flags as three more strings,
// then its value (`I` int32, `D` double, `S` string). Global settings are never compressed (only arrays are).

/** The values of FBX properties the diff reads. */
export type FbxPropertyName =
  | 'UpAxis'
  | 'UpAxisSign'
  | 'FrontAxis'
  | 'FrontAxisSign'
  | 'CoordAxis'
  | 'CoordAxisSign'
  | 'UnitScaleFactor'
  | 'TimeMode'
  | 'CustomFrameRate'
  | 'Original|ApplicationName'
  | 'Original|ApplicationVersion';

const BINARY_MAGIC = 'Kaydara FBX Binary';
/** The three strings between a property's name and its value: its type, its kind and its flags. */
const STRINGS_BEFORE_VALUE = 3;

/** A property's value, the first time the file sets it; undefined when it doesn't or the bytes can't tell. */
export function readFbxProperty(bytes: Uint8Array, name: FbxPropertyName): string | number | undefined {
  return isBinaryFbx(bytes) ? readBinaryProperty(bytes, name) : readAsciiProperty(bytes, name);
}

export function isBinaryFbx(bytes: Uint8Array): boolean {
  return latin1(bytes.subarray(0, BINARY_MAGIC.length)) === BINARY_MAGIC;
}

function readAsciiProperty(bytes: Uint8Array, name: FbxPropertyName): string | number | undefined {
  const text = new TextDecoder().decode(bytes);
  const quotedName = `"${name.replace(/[|]/g, '\\|')}"`;
  const line = new RegExp(`P:\\s*${quotedName},\\s*"[^"]*",\\s*"[^"]*",\\s*"[^"]*",\\s*([^\\r\\n]*)`).exec(text);
  if (!line) return undefined;
  const value = line[1]!.trim();
  if (value.startsWith('"')) return value.slice(1, value.indexOf('"', 1));
  const number = Number(value.split(',')[0]);
  return Number.isFinite(number) ? number : undefined;
}

function readBinaryProperty(bytes: Uint8Array, name: FbxPropertyName): string | number | undefined {
  const needle = binaryString(name);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = indexOf(bytes, needle, 0); at !== -1; at = indexOf(bytes, needle, at + 1)) {
    const value = valueAfterName(bytes, view, at + needle.length);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** The value of the property whose name ends at `offset`, past its three strings; undefined if the record doesn't read. */
function valueAfterName(bytes: Uint8Array, view: DataView, offset: number): string | number | undefined {
  let at = offset;
  for (let skipped = 0; skipped < STRINGS_BEFORE_VALUE; skipped++) {
    if (at + 5 > bytes.length || bytes[at] !== 0x53 /* S */) return undefined;
    at += 5 + view.getUint32(at + 1, true);
  }
  if (at >= bytes.length) return undefined;
  const type = String.fromCharCode(bytes[at]!);
  if (type === 'I' && at + 5 <= bytes.length) return view.getInt32(at + 1, true);
  if (type === 'D' && at + 9 <= bytes.length) return view.getFloat64(at + 1, true);
  if (type === 'S' && at + 5 <= bytes.length) {
    const length = view.getUint32(at + 1, true);
    return new TextDecoder().decode(bytes.subarray(at + 5, at + 5 + length));
  }
  return undefined;
}

/** A name as a binary FBX writes it: `S`, its length as a little-endian uint32, its bytes. */
function binaryString(value: string): Uint8Array {
  const text = new TextEncoder().encode(value);
  const encoded = new Uint8Array(5 + text.length);
  encoded[0] = 0x53;
  new DataView(encoded.buffer).setUint32(1, text.length, true);
  encoded.set(text, 5);
  return encoded;
}

function indexOf(bytes: Uint8Array, needle: Uint8Array, from: number): number {
  const first = needle[0]!;
  for (let at = bytes.indexOf(first, from); at !== -1 && at + needle.length <= bytes.length; at = bytes.indexOf(first, at + 1)) {
    let matches = true;
    for (let i = 1; i < needle.length && matches; i++) matches = bytes[at + i] === needle[i];
    if (matches) return at;
  }
  return -1;
}

function latin1(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}
