import { readFile, writeFile } from 'node:fs/promises';
import type { ContentApi } from '@shared/api/content';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { EMPTY_CONTENT, MAX_MODEL_BYTES, toFileContent } from '../files/fileContent';
import { explainLockedFile } from '../files/lockedFile';
import { saveContent } from '../files/saveContent';
import { withTempPath } from '../files/tempFile';
import { retryWhileBusy } from '../files/whileBusy';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createContentService({ cm, reviews }: ServiceContext): ContentApi {
  async function read(workspacePath: string, source: ContentSource): Promise<FileContent> {
    if (source.kind === 'empty') return EMPTY_CONTENT;
    if (source.kind === 'reviewSnapshot') return reviews.readSnapshot(workspacePath, source.path);
    const { bytes, name } = await bytesOf(workspacePath, source);
    return toFileContent(bytes, name);
  }

  async function readBytes(workspacePath: string, source: ContentSource): Promise<Uint8Array | null> {
    if (source.kind === 'empty' || source.kind === 'reviewSnapshot') return null;
    const { bytes } = await bytesOf(workspacePath, source);
    // A plain Uint8Array: IPC copies it as binary (a Buffer would arrive as one too, pool slice and all).
    return bytes.length > MAX_MODEL_BYTES ? null : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  /** A file's bytes from the disk or `cm cat`, and the name that tells what they are. */
  async function bytesOf(workspacePath: string, source: Exclude<ContentSource, { kind: 'empty' | 'reviewSnapshot' }>): Promise<{ bytes: Buffer; name: string }> {
    if (source.kind === 'workspaceFile') {
      const absolutePath = toAbsolutePath(workspacePath, source.path);
      const bytes = await readFile(absolutePath).catch((error: unknown) => {
        throw explainLockedFile(error, absolutePath);
      });
      return { bytes, name: absolutePath };
    }
    return withTempPath(async (outputFile) => {
      await saveContent(cm, workspacePath, source, outputFile);
      return { bytes: await readFile(outputFile), name: fileNameOf(source) };
    });
  }

  /** The text as the editor has it, line breaks included (the file's own). Written in place, keeping the file's identity. */
  async function writeWorkspaceFile(workspacePath: string, path: string, text: string): Promise<void> {
    const absolutePath = toAbsolutePath(workspacePath, path);
    await retryWhileBusy(() => writeFile(absolutePath, text, 'utf8')).catch((error: unknown) => {
      throw explainLockedFile(error, absolutePath);
    });
  }

  return { read, readBytes, writeWorkspaceFile };
}

/** The name that tells images and syntax apart: the spec's path when the source names no file. */
function fileNameOf(source: Extract<ContentSource, { kind: 'workspaceBase' | 'revision' | 'repositoryPath' | 'spec' }>): string {
  if (source.kind === 'workspaceBase' || source.kind === 'repositoryPath') return source.path;
  if (source.kind === 'revision') return source.fileName;
  return source.fileName ?? source.spec.split('#')[0]!;
}
