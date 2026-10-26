import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processIsRunning } from '../system/processIsRunning';
import { removeFoldersOfGoneProcesses, type OwnedFolders } from './goneProcessFolders';

/**
 * The temporary directories' names: `uvcs-<pid>-…`, with the process that owns them, so the next session can tell the
 * ones a session killed mid-command left (`removeLeftOverTempDirectories`) from another running app's.
 */
const PREFIX = 'uvcs-';

/** Writes `content` to a temporary file, runs `work` with its path and always deletes it afterwards. */
export function withTempFile<T>(content: string, work: (filePath: string) => Promise<T>): Promise<T> {
  return withTempDirectory(async (directory) => {
    const filePath = join(directory, 'content.txt');
    await writeFile(filePath, content, 'utf8');
    return work(filePath);
  });
}

/** Runs `work` with a fresh temporary file path that it may create; the file is always deleted afterwards. */
export function withTempPath<T>(work: (filePath: string) => Promise<T>): Promise<T> {
  return withTempDirectory((directory) => work(join(directory, 'content')));
}

/**
 * Runs `work` with a fresh temporary directory, deleted afterwards. On Windows a file still open (an antivirus scan,
 * a merge tool's launcher that hasn't let go) can't be deleted for a moment: deleting tries again, and a directory
 * left behind in the temp folder never fails what `work` did.
 */
export async function withTempDirectory<T>(work: (directory: string) => Promise<T>): Promise<T> {
  const directory = await createTempDirectory();
  try {
    return await work(directory);
  } finally {
    await removeTempDirectory(directory);
  }
}

/**
 * A fresh temporary directory that outlives the call, for what is kept between calls (a merge's directory decisions):
 * its owner deletes it with `removeTempDirectory`, and one a killed session left goes at the next start
 * (`removeLeftOverTempDirectories`).
 */
export function createTempDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), `${PREFIX}${process.pid}-`));
}

/** Deletes a temporary directory, trying again while Windows holds a file in it; one that stays never fails the caller. */
export async function removeTempDirectory(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
}

/**
 * Deletes the temporary directories sessions left as they were killed or crashed mid-command: those whose process is
 * gone (`removeFoldersOfGoneProcesses`). A revision opened in an app (`uvcs-rev-`), which may still hold it, stays.
 */
export function removeLeftOverTempDirectories({ tempFolder = tmpdir(), pid = process.pid, isRunning = processIsRunning }: Partial<Omit<OwnedFolders, 'prefix'>> = {}): Promise<void> {
  return removeFoldersOfGoneProcesses({ tempFolder, prefix: PREFIX, pid, isRunning });
}
