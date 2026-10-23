// `cm xlink` arguments. The command creates an xlink as a pending change (`cm xlink [-w] [-rs] <path> <folder> <point>
// [rules]`), edits one, checking it out (`-e <path> <point>`: only where it points; writable, folder and server stay),
// and adds or deletes its branch expansion rules (`-ar`/`-dr <path> <rules>`). None of it reads or writes the
// xlinked files: they come with the next update, so each is a quick command.

import { fullBranchName, type NewXlink, type XlinkPoint, type XlinkRule } from '@shared/domain/xlinks';

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

/** A folder of the xlinked repository as `cm xlink` takes it: `/`-rooted, `Assets/Lib/` → `/Assets/Lib`. */
export function repositoryFolder(folder: string): string {
  const parts = folder.trim().split(/[\\/]/).filter(Boolean);
  return `/${parts.join('/')}`;
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

export function showXlinkArgs(absolutePath: string): string[] {
  return ['xlink', '--show', absolutePath];
}
