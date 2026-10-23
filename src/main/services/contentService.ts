import { readFile, stat, writeFile } from 'node:fs/promises';
import { cmPlace, workspaceOf } from '../cm/cmPlace';
import { isMissingItemError, isNotInTreeError, isServerPathNotFoundError } from '../cm/missingItem';
import { isPurgedRevisionError } from '../cm/purgedRevision';
import type { ContentApi } from '@shared/api/content';
import type { ContentSource, FileContent } from '@shared/domain/content';
import type { Place } from '@shared/domain/place';
import { listsTree, repositoryOfSpec, spec } from '@shared/domain/specs';
import { EMPTY_CONTENT, MAX_MODEL_BYTES, PURGED_CONTENT, toFileContent } from '../files/fileContent';
import { explainLockedFile } from '../files/lockedFile';
import type { CatRevision } from '../files/RevisionCat';
import { saveContent } from '../files/saveContent';
import { withTempPath } from '../files/tempFile';
import { retryWhileBusy } from '../files/whileBusy';
import { workspaceFileOf } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createContentService({ cm, reviews, repositoryTrees, workspaceCopies, revisionCat }: Pick<ServiceContext, 'cm' | 'reviews' | 'repositoryTrees' | 'workspaceCopies' | 'revisionCat'>): ContentApi {
  async function read(place: Place, source: ContentSource): Promise<FileContent> {
    if (source.kind === 'empty') return EMPTY_CONTENT;
    if (source.kind === 'reviewSnapshot') {
      const workspacePath = workspaceOf(place, 'A review snapshot');
      return reviews.readSnapshot(workspacePath, source.path);
    }
    if (source.kind === 'repositoryPath' && source.beside) return readBeside(place, source);
    return contentOf(await bytesOf(place, source));
  }

  /**
   * A file read only beside a revision of another (`beside`: a `.meta`'s model in History), by its revision in the
   * listing that checked it. Where it wasn't there then, or the tree hasn't it, it reads as empty: an answer, as
   * `readBytes`' null is (the `.meta` then shows as its text), never a failure.
   */
  async function readBeside(place: Place, source: Extract<ContentSource, { kind: 'repositoryPath' }>): Promise<FileContent> {
    const listed = await listedRevisionOf(place, source);
    if (listed === null) return EMPTY_CONTENT;
    return contentOf(await bytesOf(place, listed));
  }

  /**
   * Null when the file isn't there (a model without a `.meta`), or its content was purged: that is an answer, which
   * the renderer keeps. Any other failure (the server, a locked file) fails, to be read again; a file past
   * `MAX_MODEL_BYTES` fails unread.
   */
  async function readBytes(place: Place, asked: ContentSource): Promise<Uint8Array | null> {
    if (asked.kind === 'empty' || asked.kind === 'reviewSnapshot') return null;
    const source = await listedRevisionOf(place, asked);
    if (source === null) return null;
    if (source.kind === 'workspaceFile') {
      const size = await stat(workspaceFileOf(workspaceOf(place, 'A workspace file'), source.path)).then(
        (stats) => stats.size,
        (error: NodeJS.ErrnoException) => (error.code === 'ENOENT' ? null : Promise.reject(error)),
      );
      if (size === null) return null;
      if (size > MAX_MODEL_BYTES) throw new Error(`${source.path} is too large to read`);
    }
    try {
      const read = await bytesOf(place, source);
      if (read === PURGED_READ) return null;
      const { bytes } = read;
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
   * its path as that revision: from the same listing when they share a folder. The listed revision is remembered, so
   * the disk's copy reads it where it has its content (`WorkspaceCopies`). Any other source as it is.
   */
  async function listedRevisionOf(place: Place, source: Exclude<ContentSource, { kind: 'empty' | 'reviewSnapshot' }>) {
    if (source.kind !== 'repositoryPath' || !listsTree(source.at)) return source;
    const inTree = (path: string) => repositoryTrees.fileAt(place, source.at, path.replace(/^\/+/, ''));
    // The revision id alone tells it: History gives `beside` only at points of the workspace's repository (`historyPointOf`).
    if (source.beside && (await inTree(source.beside.path))?.revision.revisionId !== source.beside.revisionId) return null;
    const file = await inTree(source.path);
    if (!file) return null;
    if (place.kind === 'workspace') workspaceCopies.remember(place.workspacePath, [file]);
    return { kind: 'revision' as const, revision: file.revision, fileName: source.path };
  }

  /**
   * A file's bytes from the disk or `cm cat`, and the name that tells what they are; `PURGED_READ` where `cm cat` said
   * the revision it was to write to the temp file was purged (`isPurgedRevisionError`).
   */
  async function bytesOf(place: Place, source: Exclude<ContentSource, { kind: 'empty' | 'reviewSnapshot' }>): Promise<{ bytes: Buffer; name: string } | typeof PURGED_READ> {
    if (source.kind === 'workspaceFile') {
      const absolutePath = workspaceFileOf(workspaceOf(place, 'A workspace file'), source.path);
      const bytes = await readFile(absolutePath).catch((error: unknown) => {
        throw explainLockedFile(error, absolutePath);
      });
      return { bytes, name: absolutePath };
    }
    // Only a workspace has a disk holding revisions.
    if (source.kind === 'revision' && place.kind === 'workspace') {
      const onDisk = await workspaceCopies.read(place.workspacePath, { path: source.fileName, revision: source.revision, hash: null, size: -1 });
      if (onDisk) return { bytes: onDisk, name: source.fileName };
    }
    // The loaded revision of a workspace path: kept inside the workspace as a file on disk is.
    if (source.kind === 'workspaceBase') workspaceFileOf(workspaceOf(place, 'The loaded revision of a file'), source.path);
    return withTempPath(async (outputFile) => {
      try {
        // A revision named by its spec goes with the others asked with it, in one `cm cat` (a merge's thousands of versions).
        if (source.kind === 'revision' || source.kind === 'spec') await revisionCat.save(place, catRevisionOf(place, source), outputFile);
        else await saveContent(cm, place, source, outputFile);
      } catch (error) {
        if (isPurgedRevisionError(error, outputFile)) return PURGED_READ;
        throw error;
      }
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

/** What `bytesOf` answers for a revision whose content was purged. */
const PURGED_READ = Symbol('purged');

/** The content of what `bytesOf` read: `PURGED_CONTENT` for a purged revision, an answer rather than a failure. */
function contentOf(read: { bytes: Buffer; name: string } | typeof PURGED_READ): FileContent {
  return read === PURGED_READ ? PURGED_CONTENT : toFileContent(read.bytes, read.name);
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

/** The revision as `cm cat` reads it, a spec naming the place's repository where no workspace tells `cm` which. */
function catRevisionOf(place: Place, source: Extract<ContentSource, { kind: 'revision' | 'spec' }>): CatRevision {
  if (source.kind === 'revision') return { spec: spec.revision(source.revision), repository: source.revision.repository };
  return { spec: cmPlace(place).spec(source.spec), repository: repositoryOfSpec(source.spec) };
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
