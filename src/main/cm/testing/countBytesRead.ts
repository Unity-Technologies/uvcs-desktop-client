/**
 * How many bytes the `Buffer` methods called while `run` runs read: what `indexOf` looked through, what `toString`
 * decoded, what `Buffer.concat` copied. A measure of a reader's work that is the same on any machine under any load,
 * unlike the time it takes (as `countCharactersRead` is for strings): a test bounds it per byte of input, which a
 * reader going back over the bytes (a search per record through the rest of the chunk) exceeds by far.
 */
export function countBytesRead<T>(run: () => T): { result: T; bytesRead: number } {
  let read = 0;
  const prototype = Buffer.prototype;
  const { indexOf, toString } = prototype;
  const { concat } = Buffer;
  prototype.indexOf = function (this: Buffer, value: string | number | Uint8Array, byteOffset?: number | string, encoding?: BufferEncoding) {
    const found = indexOf.call(this, value, byteOffset as number, encoding);
    const from = typeof byteOffset === 'number' ? Math.max(0, byteOffset) : 0;
    read += found < 0 ? this.length - from : found - from + 1;
    return found;
  };
  prototype.toString = function (this: Buffer, encoding?: BufferEncoding, start?: number, end?: number) {
    read += (end ?? this.length) - (start ?? 0);
    return toString.call(this, encoding, start, end);
  };
  Buffer.concat = (list: readonly Uint8Array[], totalLength?: number) => {
    read += list.reduce((sum, bytes) => sum + bytes.length, 0);
    return concat(list, totalLength);
  };
  try {
    const result = run();
    return { result, bytesRead: read };
  } finally {
    prototype.indexOf = indexOf;
    prototype.toString = toString;
    Buffer.concat = concat;
  }
}
