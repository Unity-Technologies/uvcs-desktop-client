// Where a changed xlink of a diff points on each side. `cm diff` prints an xlink with no revision on either side
// (`C#"/lib"#-1#-1#X#…`), so its target is read from the tree at each side: `cm ls <its folder> --tree=<point>`
// names it `lib -> wxlink -> / 17361@lib@ [relative] acme@cloud` (`parseXlinkName`). The older side of a changeset or a
// branch is a changeset only `cm find` names: the changeset's parent, or the parent of the branch's first changeset.

import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { XlinkTarget } from '@shared/domain/explorer';
import { listsTree } from '@shared/domain/specs';
import { equalsCondition, findQueryArgs } from './findQuery';
import { foundObjects } from './foundObjects';
import { integerValue, readRecords } from './formatRecords';
import { parseTreeItems, TREE_ITEM_FORMAT } from './treeItems';

/** A changeset's parent, the one field the older side needs. */
export const FOUND_PARENTS = foundObjects('changeset', ['parent'], (value) => ({ parent: integerValue(value('parent')) }));

/** A side of a diff: a point whose tree `cm ls` reads, or a changeset whose parent is that point. */
export type XlinkSidePoint = { kind: 'point'; spec: string } | { kind: 'parentOf'; findArgs: string[] } | null;

/** The newer side: the changeset, the range's second point, the branch's head; a shelve's tree can't be listed. */
export function xlinkAfterPoint(target: DiffTarget): XlinkSidePoint {
  switch (target.kind) {
    case 'changeset':
      return { kind: 'point', spec: `cs:${target.changesetId}` };
    case 'range':
      return { kind: 'point', spec: target.toSpec };
    case 'branch':
      return { kind: 'point', spec: `br:${target.branch}` };
    case 'shelve':
      return null;
  }
}

/**
 * The older side: the changeset's parent, the range's first point, where the branch started; none for a shelve. The
 * `cm find` names `repository` when no workspace tells `cm` which.
 */
export function xlinkBeforePoint(target: DiffTarget, repository?: string): XlinkSidePoint {
  switch (target.kind) {
    case 'changeset':
      return { kind: 'parentOf', findArgs: findQueryArgs(FOUND_PARENTS, `where changesetid = ${target.changesetId}`, repository) };
    case 'range':
      return { kind: 'point', spec: target.fromSpec };
    case 'branch':
      return {
        kind: 'parentOf',
        findArgs: findQueryArgs(FOUND_PARENTS, `where ${equalsCondition('branch', target.branch)} order by changesetid asc limit 1`, repository),
      };
    case 'shelve':
      return null;
  }
}

/** The point the `cm find` of `xlinkBeforePoint` names: the found changeset's parent; none before the first changeset. */
export function parentPointOf(findOutput: string): string | null {
  const parent = readRecords(FOUND_PARENTS, findOutput)[0]?.parent;
  return parent === undefined || parent < 0 ? null : `cs:${parent}`;
}

/** `cm ls` of the folder holding `path` (a repository path, no leading slash) in the tree at `point`. */
export function xlinkListArgs(path: string, point: string): string[] {
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return ['ls', `/${folder}`, `--tree=${point}`, TREE_ITEM_FORMAT];
}

/** Where the xlink at `path` points in that listing; null when the folder holds no xlink there. */
export function xlinkIn(listing: string, path: string): XlinkTarget | null {
  return parseTreeItems(listing).find((item) => item.path === path)?.xlink ?? null;
}

/** Whether a side is read at all: not where the xlink isn't (before an add, after a delete), nor a tree `cm ls` refuses. */
export function readsSide(point: XlinkSidePoint, side: 'before' | 'after', status: DiffEntry['status']): point is NonNullable<XlinkSidePoint> {
  if (point === null) return false;
  if ((side === 'before' && status === 'added') || (side === 'after' && status === 'deleted')) return false;
  return point.kind === 'parentOf' || listsTree(point.spec);
}
