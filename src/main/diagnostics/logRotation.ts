import { basename, dirname, extname, join } from 'node:path';

/**
 * The log's earlier files, newest first: `uvcs-desktop.1.log`, `uvcs-desktop.2.log`... They keep the `.log` extension,
 * so the OS opens them in a text editor too.
 */
export function earlierLogFiles(file: string, kept: number): string[] {
  const extension = extname(file);
  const name = basename(file, extension);
  return Array.from({ length: kept }, (_, index) => join(dirname(file), `${name}.${index + 1}${extension}`));
}

/**
 * The renames that make room for a new log file, in the order they run: the oldest kept file is replaced by the one
 * before it, and so on, up to the current file, which becomes the first earlier one. The oldest file's text is dropped.
 */
export function rotationRenames(file: string, kept: number): Array<{ from: string; to: string }> {
  const files = [file, ...earlierLogFiles(file, kept)];
  return files.slice(1).map((to, index) => ({ from: files[index]!, to })).reverse();
}

/** A file holding `size` bytes is rotated before it takes `adding` more past `maxBytes`; an empty one takes anything. */
export function rotatesBefore(size: number, adding: number, maxBytes: number): boolean {
  return size > 0 && size + adding > maxBytes;
}
