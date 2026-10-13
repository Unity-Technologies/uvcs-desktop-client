// Where to read a file a model needs beside it (a glTF's `.bin`), as the version of it that goes with each version of
// the model. A workspace file's sibling is the file beside it, on disk or as loaded. In a committed diff, a model's
// shape lives in its `.bin`, so a changed shape changed the `.bin` too, which is then an entry of the same diff with
// its own revisions; a sibling the diff didn't change is the same on both sides, read where the diff points to (the
// changeset, the branch's head, the shelve, the label; under an xlink, through the tree there). A last change in Files
// or Browse repository finds them in the tree's listings (`lastChangeSibling`). Anything else (a history's revisions,
// a merge's) finds none, and the viewer says what the model needs.

import { createContext } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { otherRepository } from '@shared/domain/repository';
import { revisionIn } from '@shared/domain/revision';
import { listsTree } from '@shared/domain/specs';

export type DiffSide = 'original' | 'modified';

/** Finds the source of `fileName` beside the model a side of the diff shows from `source`, at `path`; null when it can't. */
export type SiblingFinder = (side: DiffSide, source: ContentSource, path: string, fileName: string) => ContentSource | null;

/** What a sibling's name may be: a name or a path below the model's folder, never above it or elsewhere. */
export function siblingPath(path: string, fileName: string): string | null {
  const parts = fileName.split(/[\\/]/);
  if (fileName.startsWith('/') || /^[a-z]:/i.test(fileName) || parts.some((part) => part === '..' || part === '')) return null;
  const separator = path.includes('\\') && !path.includes('/') ? '\\' : '/';
  const folderEnd = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return `${folderEnd === -1 ? '' : path.slice(0, folderEnd + 1)}${parts.join(separator)}`;
}

/** A workspace file's sibling, on disk or as loaded; none for other sources. */
export const workspaceSibling: SiblingFinder = (_side, source, _path, fileName) => {
  if (source.kind !== 'workspaceFile' && source.kind !== 'workspaceBase') return null;
  const path = siblingPath(source.path, fileName);
  return path === null ? null : { kind: source.kind, path };
};

/**
 * A committed diff's siblings: the entry of the same diff, or the file where the diff points to when it didn't change.
 * Beside a model of another repository than `workspaceRepository` (under an xlink), that file is read through the
 * tree there, which `cm ls` can't list in a shelve or at a label (`listsTree`): there it isn't found.
 */
export function diffSibling(entries: DiffEntry[], target: DiffTarget, workspaceRepository: string | undefined): SiblingFinder {
  return (side, source, path, fileName) => {
    if (source.kind !== 'revision') return workspaceSibling(side, source, path, fileName);
    const sibling = siblingPath(path, fileName);
    if (sibling === null) return null;
    // The side before of a moved entry is at its old path: a model moved with its `.meta` finds it there.
    const entry = entries.find((candidate) => (side === 'original' ? (candidate.oldPath ?? candidate.path) : candidate.path) === sibling);
    if (entry) {
      const revision = revisionIn(entry.repository, side === 'original' ? entry.baseRevisionId : entry.revisionId);
      return revision ? { kind: 'revision', revision, fileName: sibling } : null;
    }
    const at = pointOf(target);
    const xlinked = otherRepository(source.revision.repository, workspaceRepository);
    if (!xlinked) return { kind: 'repositoryPath', path: `/${sibling}`, at };
    return listsTree(at) ? { kind: 'repositoryPath', path: `/${sibling}`, at, repository: xlinked } : null;
  };
}

/** Where a committed diff points to: a changeset, a branch's head, a shelve, the end of a range. */
export function pointOf(target: DiffTarget): string {
  switch (target.kind) {
    case 'changeset':
      return `cs:${target.changesetId}`;
    case 'branch':
      return `br:${target.branch}`;
    case 'shelve':
      return `sh:${target.shelveId}`;
    case 'range':
      return target.toSpec;
  }
}

/**
 * The path a side was read from, which its siblings are found beside: its own, never the diff's file name, which
 * names the next file while the previous one's contents still show. Null for a side read from no path.
 */
export function sourcePathOf(source: ContentSource): string | null {
  switch (source.kind) {
    case 'workspaceFile':
    case 'workspaceBase':
    case 'reviewSnapshot':
    case 'repositoryPath':
      return source.path;
    case 'revision':
      return source.fileName;
    case 'spec':
      return source.fileName ?? (/^serverpath:([^#]+)/.exec(source.spec)?.[1] ?? null);
    case 'empty':
      return null;
  }
}

/**
 * How the model viewer finds siblings where it shows: workspace files anywhere; a committed diff's where `DiffBrowser`
 * provides `diffSibling`, a last change's where `RevisionChanges` provides `lastChangeSibling`.
 */
export const SiblingFinderContext = createContext<SiblingFinder>(workspaceSibling);
