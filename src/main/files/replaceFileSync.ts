import * as nodeFs from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** What replacing a file needs of the file system; tests pass a fake. */
export type ReplaceFileSystem = Pick<typeof nodeFs, 'writeFileSync' | 'renameSync' | 'rmSync'>;

interface ReplaceOptions {
  fs?: ReplaceFileSystem;
  platform?: NodeJS.Platform;
  /** Blocks for `ms`: the callers are synchronous. */
  sleep?: (ms: number) => void;
}

/** What Windows answers while another program (an antivirus scan, the search indexer) has the file open. */
const BUSY_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);
/** A few tries, a third of a second in all at most: the main process waits meanwhile. */
const RETRY_DELAYS_MS = [20, 50, 100, 150];

/**
 * Replaces a file's content whole or not at all: writes a temp file in the same folder, then renames it over the file
 * (a rename within a folder is atomic), so a crash or a full disk midway leaves the old file, never half of the new
 * one. On Windows the rename is tried again for a moment while another program holds the file; it fails after that,
 * taking its temp file away.
 */
export function replaceFileSync(filePath: string, content: string, { fs = nodeFs, platform = process.platform, sleep = sleepSync }: ReplaceOptions = {}): void {
  const tempPath = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tempPath, content);
  try {
    renameWhileBusy(fs, tempPath, filePath, platform, sleep);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
}

function renameWhileBusy(fs: ReplaceFileSystem, from: string, to: string, platform: NodeJS.Platform, sleep: (ms: number) => void): void {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (platform !== 'win32' || !BUSY_CODES.has(code) || attempt >= RETRY_DELAYS_MS.length) throw error;
      sleep(RETRY_DELAYS_MS[attempt]!);
    }
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
