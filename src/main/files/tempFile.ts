import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Writes `content` to a temporary file, runs `work` with its path and always deletes it afterwards. */
export async function withTempFile<T>(content: string, work: (filePath: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'uvcs-'));
  const filePath = join(directory, 'content.txt');
  try {
    await writeFile(filePath, content, 'utf8');
    return await work(filePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Runs `work` with a fresh temporary file path that it may create; the file is always deleted afterwards. */
export async function withTempPath<T>(work: (filePath: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'uvcs-'));
  try {
    return await work(join(directory, 'content'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
