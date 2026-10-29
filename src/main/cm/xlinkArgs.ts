// `cm xlink` arguments. The command creates an xlink as a pending change (`cm xlink [-w] [-rs] <path> <folder> <point>
// [rules]`), edits one, checking it out (`-e <path> <point>`: only where it points; writable, folder and server stay),
// and adds or deletes its branch expansion rules (`-ar`/`-dr <path> <rules>`). None of it reads or writes the
// xlinked files, so each is a quick command: they come once the xlink is checked in and its folder updated
// (`loadXlinkArgs`).

import { fullBranchName, repositoryFolder, type NewXlink, type XlinkPoint, type XlinkRule } from '@shared/domain/xlinks';
import { equalsCondition, findArgs } from './findQuery';
import { FOUND_LABELS } from './foundObjects';
import { toAbsolutePath } from '../files/workspacePaths';
import { TREE_ITEM_FORMAT } from './treeItems';

/** Where an xlink points, as `cm xlink` takes it: a changeset, branch or label spec in its repository (`name@server`). */
export function xlinkPointSpec(point: XlinkPoint, repository: string): string {
  switch (point.kind) {
    case 'changeset':
      return `cs:${point.changeset}@${repository}`;
    case 'branch':
      return `br:${fullBranchName(point.branch)}@${repository}`;
    case 'label':
      return `lb:${point.label.trim()}@${repository}`;
  }
}

/**
 * A rule as `cm xlink` takes it: `br:/main-br:/main/dev`, each branch in the repository its side names. `cm` splits it
 * at `-br:/` (`XlinkRulesParser`), so a hyphen in a branch name (`/main/fix-1`) reads right: a full name starts with `/`.
 */
export function xlinkRuleArg({ from, to }: XlinkRule): string {
  return `br:${fullBranchName(from)}-br:${fullBranchName(to)}`;
}

/** `cm xlink` creating `xlink` at `absolutePath`. Only a read-only xlink shows a folder of its repository. */
export function createXlinkArgs(absolutePath: string, xlink: NewXlink): string[] {
  const flags = [...(xlink.writable ? ['-w'] : []), ...(xlink.relativeServer ? ['-rs'] : [])];
  const folder = xlink.writable ? '/' : repositoryFolder(xlink.folder);
  const rules = xlink.writable ? xlink.rules.map(xlinkRuleArg) : [];
  return ['xlink', ...flags, absolutePath, folder, xlinkPointSpec(xlink.point, xlink.repository), ...rules];
}

export function editXlinkPointArgs(absolutePath: string, point: XlinkPoint, repository: string): string[] {
  return ['xlink', '-e', absolutePath, xlinkPointSpec(point, repository)];
}

export function addXlinkRulesArgs(absolutePath: string, rules: readonly XlinkRule[]): string[] {
  return ['xlink', '--addrules', absolutePath, ...rules.map(xlinkRuleArg)];
}

export function deleteXlinkRulesArgs(absolutePath: string, rules: readonly XlinkRule[]): string[] {
  return ['xlink', '--deleterules', absolutePath, ...rules.map(xlinkRuleArg)];
}

/**
 * `cm update` of the folder holding a checked-in xlink (the workspace's root, named, for one at the root), which loads
 * its files. Not the xlink's own folder: for an xlink showing a folder of its repository, `cm` fails there ("Can't move
 * to <folder>") and removes the folder. Nor the workspace unnamed: it is at the changeset that added the xlink already,
 * and `cm update` may find it up to date. Updating a folder brings nothing else in: `cm` refuses a partial update while
 * the workspace is out of date ("Cannot perform a partial update when the workspace is out of date"). Updating a folder, `cm`
 * looks for pending changes in the whole workspace first, and does as client.conf's PendingChangesOnSwitchAction says:
 * with none set, as by default, it updates the folder and leaves them as they are; set to shelve them, it would shelve,
 * undo and merge them back itself, which `--machinereadable` turns into refusing (as a setting to fail does), so the
 * app moves them aside itself (`loadXlink`). `--noinput`: never ask; `--dontmerge`: never open a merge tool.
 */
export function loadXlinkArgs(workspacePath: string, xlinkPath: string, platform: NodeJS.Platform = process.platform): string[] {
  const holdingFolder = xlinkPath.split('/').slice(0, -1).join('/');
  return ['update', toAbsolutePath(workspacePath, holdingFolder, platform), '--machinereadable', '--noinput', '--dontmerge'];
}

export function showXlinkArgs(absolutePath: string): string[] {
  return ['xlink', '--show', absolutePath];
}

/**
 * The tree `cm ls --tree=<spec>` lists where an xlink points: a changeset's or a branch head's, in its repository. A
 * label's can't be listed (`cm`: "Incorrect object specification lb:…"): null, read at its changeset instead.
 */
export function xlinkTreeSpec(point: XlinkPoint, repository: string): string | null {
  return point.kind === 'label' ? null : xlinkPointSpec(point, repository);
}

/** `cm find` of the changeset a label of `repository` is on, by its name. */
export function labelChangesetArgs(label: string, repository: string): string[] {
  return findArgs(FOUND_LABELS, {}, null, [equalsCondition('name', label.trim())], repository);
}

/** `cm ls` of a folder (`/Assets`) of the tree at `treeSpec`, which `parseTreeItems` reads. */
export function repositoryFolderArgs(folder: string, treeSpec: string): string[] {
  return ['ls', repositoryFolder(folder), `--tree=${treeSpec}`, TREE_ITEM_FORMAT];
}
