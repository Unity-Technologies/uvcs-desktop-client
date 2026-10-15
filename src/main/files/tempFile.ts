import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processIsRunning } from '../system/processIsRunning';

/**
 * The temporary directories' names: `uvcs-<pid>-…`, with the process that owns them, so the next session can tell the
 * ones a session killed mid-command left (`removeLeftOverTempDirectories`) from another running app's.
 */
const OWNED = /^uvcs-(\d+)-/;

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
  const directory = await mkdtemp(join(tmpdir(), `uvcs-${process.pid}-`));
  try {
    return await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
  }
}

interface LeftOverOptions {
  tempFolder?: string;
  /** This process's id, and whether another is running: what tells a directory left over from one in use. */
  pid?: number;
  isRunning?: (pid: number) => boolean;
}

/**
 * Deletes the temporary directories sessions left as they were killed or crashed mid-command: those whose process is
 * gone. Another app's running now (a development build beside the installed one) stays, and so does anything not
 * named by its owner: a revision opened in an app (`uvcs-rev-`), which may still hold it.
 */
export async function removeLeftOverTempDirectories({ tempFolder = tmpdir(), pid = process.pid, isRunning = processIsRunning }: LeftOverOptions = {}): Promise<void> {
  const names = await readdir(tempFolder).catch(() => []);
  const leftOver = names.filter((name) => {
    const owner = OWNED.exec(name);
    return owner !== null && Number(owner[1]) !== pid && !isRunning(Number(owner[1]));
  });
  await Promise.all(leftOver.map((name) => rm(join(tempFolder, name), { recursive: true, force: true }).catch(() => undefined)));
}
