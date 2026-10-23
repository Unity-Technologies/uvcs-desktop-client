import type { NewXlink, XlinkEdit, XlinkExpansionRule, XlinkPoint } from '../domain/xlinks';

export interface XlinksApi {
  /** The branch expansion rules of the xlink at `path`, a workspace path (`cm xlink --show`): a read-only one has none. */
  rules(workspacePath: string, path: string): Promise<XlinkExpansionRule[]>;
  /**
   * Creates an xlink, a pending change (`cm xlink`): its folder fills with the repository's files once it is checked
   * in and the workspace updated.
   */
  create(workspacePath: string, xlink: NewXlink): Promise<void>;
  /**
   * The tree where `point` is in `repository`, as `folders` lists it: a changeset's or branch head's spec at once; a
   * label is read at its changeset, which one `cm find` names.
   */
  treePoint(workspacePath: string, repository: string, point: XlinkPoint): Promise<string>;
  /** The folders directly inside `folder` (`/` is the root) of the tree at `treeSpec` (`treePoint`), `/`-rooted and sorted. */
  folders(workspacePath: string, treeSpec: string, folder: string): Promise<string[]>;
  /** Points an xlink elsewhere and changes its rules, checking it out: a `cm xlink` for each kind of change. */
  edit(workspacePath: string, edit: XlinkEdit): Promise<void>;
}
