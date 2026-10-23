import type { NewXlink, XlinkEdit, XlinkExpansionRule } from '../domain/xlinks';

export interface XlinksApi {
  /** The branch expansion rules of the xlink at `path`, a workspace path (`cm xlink --show`): a read-only one has none. */
  rules(workspacePath: string, path: string): Promise<XlinkExpansionRule[]>;
  /**
   * Creates an xlink, a pending change (`cm xlink`): its folder fills with the repository's files once it is checked
   * in and the workspace updated.
   */
  create(workspacePath: string, xlink: NewXlink): Promise<void>;
  /** Points an xlink elsewhere and changes its rules, checking it out: a `cm xlink` for each kind of change. */
  edit(workspacePath: string, edit: XlinkEdit): Promise<void>;
}
