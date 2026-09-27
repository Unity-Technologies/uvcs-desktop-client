import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  const directory = await mkdtemp(join(tmpdir(), 'uvcs-'));
  try {
    return await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
  }
}
