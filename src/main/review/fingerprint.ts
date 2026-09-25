import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

/** Past this, files are told apart by size and modification time instead of reading them whole. */
export const MAX_HASHED_BYTES = 50 * 1024 * 1024;

/** What a file looked like: its content hash, and the size and time that let a later check skip re-reading it. */
export interface Fingerprint {
  hash: string;
  size: number;
  mtimeMs: number;
}

/** A fingerprint, with the bytes it was computed from when the file was read. */
export interface ReadFingerprint extends Fingerprint {
  bytes?: Buffer;
}

export async function fingerprintFile(absolutePath: string): Promise<ReadFingerprint> {
  const info = await stat(absolutePath).catch(() => null);
  if (!info) return { hash: 'missing', size: 0, mtimeMs: 0 };
  if (info.isDirectory()) return { hash: 'directory', size: 0, mtimeMs: 0 };
  const { size, mtimeMs } = info;
  if (size > MAX_HASHED_BYTES) return { hash: `size:${size}:${mtimeMs}`, size, mtimeMs };
  const bytes = await readFile(absolutePath);
  return { hash: createHash('sha1').update(bytes).digest('hex'), size, mtimeMs, bytes };
}

/** Whether the file still looks like `before` without reading it: same size and modification time. */
export async function looksUnchanged(absolutePath: string, before: Fingerprint): Promise<boolean> {
  const info = await stat(absolutePath).catch(() => null);
  if (!info) return before.hash === 'missing';
  if (info.isDirectory()) return before.hash === 'directory';
  return info.size === before.size && info.mtimeMs === before.mtimeMs;
}
