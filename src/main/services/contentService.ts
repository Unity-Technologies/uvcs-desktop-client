import { readFile, stat, writeFile } from 'node:fs/promises';
import { isMissingItemError, isServerPathNotFoundError } from '../cm/missingItem';
import type { ContentApi } from '@shared/api/content';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { listsTree } from '@shared/domain/specs';
import { EMPTY_CONTENT, MAX_MODEL_BYTES, toFileContent } from '../files/fileContent';
import { explainLockedFile } from '../files/lockedFile';
import { saveContent } from '../files/saveContent';
import { withTempPath } from '../files/tempFile';
import { retryWhileBusy } from '../files/whileBusy';
import { workspaceFileOf } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createContentService({ cm, reviews }: ServiceContext): ContentApi {
  async function read(workspacePath: string, source: ContentSource): Promise<FileContent> {
    if (source.kind === 'empty') return EMPTY_CONTENT;
    if (source.kind === 'reviewSnapshot') return reviews.readSnapshot(workspacePath, source.path);
    const { bytes, name } = await bytesOf(workspacePath, source);
    return toFileContent(bytes, name);
  }

  /**
   * Null when the file isn't there (a model without a `.meta`): that is an answer, which the renderer keeps. Any other
   * failure (the server, a locked file) fails, to be read again; a file past `MAX_MODEL_BYTES` fails unread.
   */
  async function readBytes(workspacePath: string, source: ContentSource): Promise<Uint8Array | null> {
    if (source.kind === 'empty' || source.kind === 'reviewSnapshot') return null;
    if (source.kind === 'workspaceFile') {
      const size = await stat(workspaceFileOf(workspacePath, source.path)).then(
        (stats) => stats.size,
        (error: NodeJS.ErrnoException) => (error.code === 'ENOENT' ? null : Promise.reject(error)),
      );
      if (size === null) return null;
      if (size > MAX_MODEL_BYTES) throw new Error(`${source.path} is too large to read`);
    }
    try {
      const { bytes } = await bytesOf(workspacePath, source);
      if (bytes.length > MAX_MODEL_BYTES) throw new Error(`${fileNameOfAny(source)} is too large to read`);
      // A plain Uint8Array: IPC copies it as binary (a Buffer would arrive as one too, pool slice and all).
      return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    } catch (error) {
      if (isMissingItem(error) || isMissingFromShelve(source, error)) return null;
      throw error;
    }
  }

  /** A file's bytes from the disk or `cm cat`, and the name that tells what they are. */
  async function bytesOf(workspacePath: string, source: Exclude<ContentSource, { kind: 'empty' | 'reviewSnapshot' }>): Promise<{ bytes: Buffer; name: string }> {
    if (source.kind === 'workspaceFile') {
      const absolutePath = workspaceFileOf(workspacePath, source.path);
      const bytes = await readFile(absolutePath).catch((error: unknown) => {
        throw explainLockedFile(error, absolutePath);
      });
      return { bytes, name: absolutePath };
    }
    // The loaded revision of a workspace path: kept inside the workspace as a file on disk is.
    if (source.kind === 'workspaceBase') workspaceFileOf(workspacePath, source.path);
    return withTempPath(async (outputFile) => {
      await saveContent(cm, workspacePath, source, outputFile);
      return { bytes: await readFile(outputFile), name: fileNameOf(source) };
    });
  }

  /** The text as the editor has it, line breaks included (the file's own). Written in place, keeping the file's identity. */
  async function writeWorkspaceFile(workspacePath: string, path: string, text: string): Promise<void> {
    const absolutePath = workspaceFileOf(workspacePath, path);
    await retryWhileBusy(() => writeFile(absolutePath, text, 'utf8')).catch((error: unknown) => {
      throw explainLockedFile(error, absolutePath);
    });
  }

  return { read, readBytes, writeWorkspaceFile };
}

/** `cm` telling an item isn't there (`isMissingItemError`), or the disk telling a file isn't. */
function isMissingItem(error: unknown): boolean {
  return isMissingItemError(error) || (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

/**
 * A shelve's path whose `serverpath:` found nothing: no tree can be asked there (`listsTree`), so that is the answer.
 * Not for a path known to be under an xlink (never read by `serverpath:`), nor at a changeset or a branch, where the
 * tree is asked and answers itself.
 */
function isMissingFromShelve(source: ContentSource, error: unknown): boolean {
  return source.kind === 'repositoryPath' && source.repository === undefined && !listsTree(source.at) && isServerPathNotFoundError(error);
}

function fileNameOfAny(source: Exclude<ContentSource, { kind: 'empty' | 'reviewSnapshot' }>): string {
  return source.kind === 'workspaceFile' ? source.path : fileNameOf(source);
}

/** The name that tells images and syntax apart: the spec's path when the source names no file. */
function fileNameOf(source: Extract<ContentSource, { kind: 'workspaceBase' | 'revision' | 'repositoryPath' | 'spec' }>): string {
  if (source.kind === 'workspaceBase' || source.kind === 'repositoryPath') return source.path;
  if (source.kind === 'revision') return source.fileName;
  return source.fileName ?? source.spec.split('#')[0]!;
}
