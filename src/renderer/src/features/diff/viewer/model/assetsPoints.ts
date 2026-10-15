// Where each version a model viewer shows is (its `AssetsPoint`), so the Materials look finds the materials and
// textures that go with it (docs/features/model-diff.md, "Materials"): a workspace file's are the disk's; a committed
// diff's, the repository's tree where the diff points to (the side before with the diff's own changes undone); a
// history's revision, the tree at the changeset that made it; Files' last change, the tree at its changeset, and
// before it. Anything else (a merge's versions, a shelve's or a label's tree, which `cm ls` can't list) has none: only
// what the file itself holds shows, never the disk's files of another revision.

import { createContext } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { listsTree } from '@shared/domain/specs';
import { MAX_CHANGED_ASSETS, type AssetsPoint, type ChangedAsset } from '@shared/domain/unityAssets';
import { historyPointOf, pointOf, type DiffSide, type HistoryPoints } from './modelSiblings';

/** The point of the version a side shows from `source`; null where none is known. */
export type AssetsPointFinder = (side: DiffSide, source: ContentSource) => AssetsPoint | null;

const WORKSPACE: AssetsPoint = { kind: 'workspace' };

/** A workspace file's point is the disk; nothing else's is known. */
export const workspaceAssetsPoint: AssetsPointFinder = (_side, source) => (source.kind === 'workspaceFile' || source.kind === 'workspaceBase' ? WORKSPACE : null);

/**
 * A committed diff's: the tree where it points to (a changeset, a branch's head); the side before, that tree with the
 * diff's changes as they were before it (`changedAssetsOf`). A shelve's or a label's tree can't be listed: none.
 */
export function diffAssetsPoint(entries: readonly DiffEntry[], target: DiffTarget): AssetsPointFinder {
  const at = pointOf(target);
  let changes: ChangedAsset[] | null | undefined;
  return (side, source) => {
    if (source.kind !== 'revision') return workspaceAssetsPoint(side, source);
    if (!listsTree(at)) return null;
    if (side === 'modified') return { kind: 'repository', at };
    changes ??= changedAssetsOf(entries);
    return changes ? { kind: 'repository', at, before: { kind: 'changes', changes } } : null;
  };
}

/**
 * Each file the diff changed, as it was before it: its base revision, or none where the diff added it; a move both
 * ways (gone from where it went, there where it was). Null past `MAX_CHANGED_ASSETS`, a diff too large to undo.
 */
export function changedAssetsOf(entries: readonly DiffEntry[]): ChangedAsset[] | null {
  const changes: ChangedAsset[] = [];
  for (const entry of entries) {
    if (entry.itemType === 'directory') continue;
    const base = entry.baseRevisionId < 0 ? null : { revisionId: entry.baseRevisionId, repository: entry.repository };
    if (entry.oldPath !== undefined && entry.oldPath !== entry.path) {
      changes.push({ path: entry.path, revision: null }, { path: entry.oldPath, revision: base });
    } else {
      changes.push({ path: entry.path, revision: base });
    }
  }
  return changes.length > MAX_CHANGED_ASSETS ? null : changes;
}

/**
 * The point as one model's lookups read it: a diff's side before keeps only the changes they can reach, those under
 * the model's Unity project (the folder holding the outermost `Assets` above it, where main's search stays) or, outside
 * one, under its folder. A diff of thousands of files then asks with the few that matter, in every request and query
 * key.
 */
export function pointForModel(point: AssetsPoint, modelPath: string): AssetsPoint {
  if (point.kind !== 'repository' || point.before?.kind !== 'changes') return point;
  const parts = modelPath.split('/');
  const assets = parts.slice(0, -1).findIndex((part) => part.toLowerCase() === 'assets');
  const top = (assets === -1 ? parts.slice(0, -1) : parts.slice(0, assets)).join('/');
  const changes = point.before.changes.filter((change) => top === '' || change.path.startsWith(`${top}/`));
  return { ...point, before: { kind: 'changes', changes } };
}

/**
 * Whether a revision of `repository` is in the workspace's: undefined while the workspace's isn't known yet, when no
 * point is given (a revision of an xlinked repository would list the wrong tree meanwhile).
 */
export function inWorkspaceRepository(repository: string, workspaceRepository: string | undefined): boolean | undefined {
  return workspaceRepository === undefined ? undefined : repository === workspaceRepository;
}

/** Two revisions of a history, each at the changeset that made it, where it has one (`historyPointOf`). */
export function revisionsAssetsPoint(points: HistoryPoints): AssetsPointFinder {
  return (side, source) => {
    if (source.kind !== 'revision') return workspaceAssetsPoint(side, source);
    const at = historyPointOf(points, side);
    return at === null ? null : { kind: 'repository', at };
  };
}

/**
 * Files' last change of an item, made in `changeset`: the tree there, and before it, that tree with what the changeset
 * made undone. Only in the workspace's repository (as `revisionsAssetsPoint`); none for a shelve's change.
 */
export function lastChangeAssetsPoint(changeset: number | null, repository: string, inWorkspaceRepository: boolean | undefined): AssetsPointFinder {
  return (side, source) => {
    if (source.kind !== 'revision') return workspaceAssetsPoint(side, source);
    if (!inWorkspaceRepository || changeset === null || changeset < 0) return null;
    const at = `cs:${changeset}`;
    return side === 'modified' ? { kind: 'repository', at } : { kind: 'repository', at, before: { kind: 'changeset', changeset, repository } };
  };
}

/** How the model viewer finds its versions' points: workspace files anywhere; the others where a view provides it. */
export const AssetsPointContext = createContext<AssetsPointFinder>(workspaceAssetsPoint);
