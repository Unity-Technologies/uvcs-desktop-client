/**
 * What an xlink points to in its repository. An xlink always stores a changeset: a branch or a label is turned into
 * the changeset it is on as the xlink is saved, and the xlink stays there until it is edited again.
 */
export type XlinkPoint = { kind: 'changeset'; changeset: number } | { kind: 'branch'; branch: string } | { kind: 'label'; label: string };

/**
 * A branch expansion rule of a writable xlink: a change made under the xlink while the workspace is on `from` (a
 * branch of the workspace's repository, `/main/task1`) is checked in on `to` (a branch of the xlinked repository).
 */
export interface XlinkRule {
  from: string;
  to: string;
}

/** A rule as the xlink holds it. */
export interface XlinkExpansionRule extends XlinkRule {
  /** Added by someone; otherwise `cm` added it when a change under the xlink created the xlinked repository's branch. */
  userDefined: boolean;
}

/** A new xlink (`XlinksApi.create`). */
export interface NewXlink {
  /** Its folder in the workspace, a workspace path (`code/lib`): the folder holding it must be controlled. */
  path: string;
  /** The repository it shows, `name@server`. */
  repository: string;
  point: XlinkPoint;
  /** A writable xlink takes changes made under it, checked in to its repository; a read-only one doesn't. */
  writable: boolean;
  /** Finds its repository on the server the workspace's repository is on (`-rs`): for repositories replicated to several. */
  relativeServer: boolean;
  /** The folder of the repository it shows, `/` for all of it: only a read-only xlink shows less. */
  folder: string;
  rules: XlinkRule[];
}

/** A change to an xlink (`XlinksApi.edit`): what changed only. */
export interface XlinkEdit {
  path: string;
  /** Its repository, `name@server`: where `point` is looked up. */
  repository: string;
  /** Where it points now; left out when that doesn't change. */
  point?: XlinkPoint;
  /** Rules to drop. A rule that changes is dropped and added again: `cm` refuses a second rule for the same branch. */
  removedRules: XlinkRule[];
  addedRules: XlinkRule[];
}

/** A branch's full name, as `cm` names it in specs and rules: `main/task1` and `/main/task1` are the same branch. */
export function fullBranchName(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * A folder of a repository as `cm` takes it and the folder picker shows it: `/`-rooted, whatever separators and
 * spaces it was typed with (`Assets\Lib\` → `/Assets/Lib`); `/` for the root.
 */
export function repositoryFolder(folder: string): string {
  const parts = folder.split(/[\\/]/).map((part) => part.trim()).filter(Boolean);
  return `/${parts.join('/')}`;
}
