import { workspacePlace } from '@shared/domain/place';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { runRead } from '../../app/operations/runOperation';
import { menuAction } from '../../components/menuWords';
import type { GroupedEntry } from '../../lib/menuGroups';
import { readChangeset } from '../changesets/useChangeset';
import { revertItemTo } from '../history/revisionOperations';

/**
 * Where a diff's older side is, as a changeset `cm revert` can take (`file#cs:N`): a changeset's diff starts from its
 * parent, known once read; a range of changesets from its first one.
 */
export type OlderSide = { kind: 'changeset'; changesetId: number } | { kind: 'parentOf'; changesetId: number };

/**
 * The older side of a diff, or null where no changeset names it: a branch's diff starts from its common ancestor with
 * its parent (`--integration`), which no read names; a shelve's base is no changeset of the shelve's. A range between
 * labels starts from a label: `cm revert` takes `<file>#lb:<label>`, but `history.revertTo` takes a changeset number,
 * so label ranges are left out until it takes a spec.
 */
export function olderSideOf(target: DiffTarget): OlderSide | null {
  if (target.kind === 'changeset') return { kind: 'parentOf', changesetId: target.changesetId };
  if (target.kind !== 'range') return null;
  const changesetId = /^cs:(\d+)$/.exec(target.fromSpec)?.[1];
  return changesetId === undefined ? null : { kind: 'changeset', changesetId: Number(changesetId) };
}

/**
 * Whether undoing a diff's change to this item makes sense in the workspace: a file whose content the diff changed, in
 * its place or moved too (`cm revert` finds the item by its id, takes its content back and leaves its name, so a move
 * alone has nothing to revert; an added file had no older version, a deleted one none in the workspace), in the
 * workspace's own repository: an xlinked one's changesets aren't the diff's, and the workspace's repository must be
 * known to tell.
 */
export function canRevertFromDiff(entry: DiffEntry, workspaceRepository: string | undefined): boolean {
  const isFile = entry.itemType !== 'directory' && entry.itemType !== 'xlink';
  return isFile && changedContent(entry) && workspaceRepository !== undefined && entry.repository === workspaceRepository;
}

/**
 * A file whose content changed, moved or not: its two revisions differ (`mergedDiffEntries` keeps a moved file's content
 * change's). A file only moved, or whose permissions alone changed, is one revision on both sides.
 */
function changedContent(entry: DiffEntry): boolean {
  return (entry.status === 'changed' || entry.status === 'moved') && entry.baseRevisionId !== entry.revisionId;
}

/**
 * "Revert file to before this change…" for the one file selected in a diff of the workspace's repository, as the
 * native client's "Revert changes" does: the file goes back to the diff's older side, its later changes undone too.
 * The Unity `.meta` listed with it (`meta`, `pairDiffMetas`) goes back with it, where it can be reverted too. None for
 * several files, a file it can't revert (`canRevertFromDiff`) or a diff with no changeset before it.
 */
export function revertFromDiffEntry(
  workspacePath: string,
  target: DiffTarget,
  entries: DiffEntry[],
  workspaceRepository: string | undefined,
  meta?: DiffEntry,
): GroupedEntry | null {
  const entry = entries.length === 1 ? entries[0]! : null;
  const olderSide = olderSideOf(target);
  if (!entry || !olderSide || !canRevertFromDiff(entry, workspaceRepository)) return null;
  const metaPath = meta && canRevertFromDiff(meta, workspaceRepository) ? meta.path : undefined;
  return menuAction('revert', () => void revertToOlderSide(workspacePath, entry.path, olderSide, metaPath), {
    label: metaPath === undefined ? 'Revert file to before this change…' : 'Revert file and its .meta to before this change…',
  });
}

/**
 * Reverts the file, and its `.meta` where given, to the older side's changeset, after confirming it by number
 * (`revertItemTo`), and for a changeset's diff the changeset it undoes too.
 */
export async function revertToOlderSide(workspacePath: string, path: string, olderSide: OlderSide, metaPath?: string): Promise<void> {
  const changesetId = await changesetOf(workspacePath, olderSide);
  const undoing = olderSide.kind === 'parentOf' ? olderSide.changesetId : undefined;
  if (changesetId !== undefined) await revertItemTo(workspacePath, path, changesetId, { undoing, metaPath });
}

async function changesetOf(workspacePath: string, olderSide: OlderSide): Promise<number | undefined> {
  if (olderSide.kind === 'changeset') return olderSide.changesetId;
  const changeset = await runRead("Couldn't read the changeset", () => readChangeset(workspacePlace(workspacePath), olderSide.changesetId));
  return changeset?.parent;
}
