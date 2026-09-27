import { basename } from 'node:path';

/**
 * A file another app holds open without sharing it (on Windows: Excel, some editors, an antivirus scan) can't be read
 * or written, and Node says only "EBUSY: resource busy or locked". Says it in the user's words; other errors stay.
 */
export function explainLockedFile(error: unknown, path: string): unknown {
  if ((error as NodeJS.ErrnoException | null)?.code !== 'EBUSY') return error;
  return new Error(`${basename(path)} is open in another app that locks it. Close it there and try again.`);
}
