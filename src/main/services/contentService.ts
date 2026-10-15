import { readFile, stat, writeFile } from 'node:fs/promises';
import { isMissingItemError, isNotInTreeError, isServerPathNotFoundError } from '../cm/missingItem';
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

export function createContentService({ cm, reviews, repositoryTrees }: Pick<ServiceContext, 'cm' | 'reviews' | 'repositoryTrees'>): ContentApi {
  async function read(workspacePath: string, source: ContentSource): Promise<FileContent> {
    if (source.kind === 'empty') return EMPTY_CONTENT;
    if (source.kind === 'reviewSnapshot') return reviews.readSnapshot(workspacePath, source.path);
    if (source.kind === 'repositoryPath' && source.beside) return readBeside(workspacePath, source);
    const { bytes, name } = await bytesOf(workspacePath, source);
    return toFileContent(bytes, name);
  }

  /** A file read only beside a revision of another (`beside`): by its revision in the listing that checked it; it fails where it wasn't there. */
  async function readBeside(workspacePath: string, source: Extract<ContentSource, { kind: 'repositoryPath' }>): Promise<FileContent> {
    const listed = await listedRevisionOf(workspacePath, source);
    if (listed === null) throw new Error(`${source.path.split('/').pop()} wasn't beside ${source.beside!.path} at ${source.at}`);
    const { bytes, name } = await bytesOf(workspacePath, listed);
    return toFileContent(bytes, name);
  }

  /**
   * Null when the file isn't there (a model without a `.meta`): that is an answer, which the renderer keeps. Any other
   * failure (the server, a locked file) fails, to be read again; a file past `MAX_MODEL_BYTES` fails unread.
   */
  async function readBytes(workspacePath: string, asked: ContentSource): Promise<Uint8Array | null> {
    if (asked.kind === 'empty' || asked.kind === 'reviewSnapshot') return null;
    const source = await listedRevisionOf(workspacePath, asked);
    if (source === null) return null;
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
      if (isMissingItem(error) || isMissingWhereNoTreeIsListed(source, error)) return null;
      throw error;
    }
  }

  /**
   * A file at a point whose tree `cm ls` lists (a model's `.meta` or `.bin` beside it at a changeset or branch head),
   * as its revision there, from the listing of its folder that the model's other reads there share
   * (`RepositoryTrees`): one `cm ls`, then one `cm cat` by revision; null where the tree hasn't the file, which costs
   * no failing command (a `serverpath:` and a tree asked in turn did), or where what it goes with (`beside`) wasn't at
   * its path as that revision: from the same listing when they share a folder. Any other source as it is.
   */
  async function listedRevisionOf(workspacePath: string, source: Exclude<ContentSource, { kind: 'empty' | 'reviewSnapshot' }>) {
    if (source.kind !== 'repositoryPath' || !listsTree(source.at)) return source;
    const inTree = (path: string) => repositoryTrees.revisionAt(workspacePath, source.at, path.replace(/^\/+/, ''));
    if (source.beside && (await inTree(source.beside.path))?.revisionId !== source.beside.revisionId) return null;
    const revision = await inTree(source.path);
    return revision && { kind: 'revision' as const, revision, fileName: source.path };
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

/** `cm` telling an item isn't there (`isMissingItemError`) or a tree that hasn't it (`isNotInTreeError`), or the disk. */
function isMissingItem(error: unknown): boolean {
  return isMissingItemError(error) || isNotInTreeError(error) || (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

/**
 * A path whose `serverpath:` found nothing at a point whose tree `cm ls` can't list (`listsTree`: a shelve, a label):
 * nothing else can be asked there, so that is the answer. Not for a path known to be under an xlink (never read by
 * `serverpath:`), nor at a changeset or a branch, where the tree is asked and its answer decides.
 */
function isMissingWhereNoTreeIsListed(source: ContentSource, error: unknown): boolean {
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
