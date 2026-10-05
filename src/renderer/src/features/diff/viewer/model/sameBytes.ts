/**
 * Whether two reads of a file are the same bytes: a pending file is read anew on every focus and refresh, as new
 * arrays, which mustn't parse it again. Four bytes at a time; a few milliseconds for a 50 MB model.
 */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true;
  if (a.byteLength !== b.byteLength) return false;
  const words = Math.floor(a.byteLength / 4);
  const aligned = a.byteOffset % 4 === 0 && b.byteOffset % 4 === 0;
  if (aligned) {
    const left = new Uint32Array(a.buffer, a.byteOffset, words);
    const right = new Uint32Array(b.buffer, b.byteOffset, words);
    for (let i = 0; i < words; i++) if (left[i] !== right[i]) return false;
  } else {
    for (let i = 0; i < words * 4; i++) if (a[i] !== b[i]) return false;
  }
  for (let i = words * 4; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}
