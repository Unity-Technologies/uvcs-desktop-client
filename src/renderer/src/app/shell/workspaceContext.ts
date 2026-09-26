import type { IncomingSummary } from '@shared/domain/incoming';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { SELECTOR_KIND_LABELS, workingObjectName } from '../../components/workingObject';
import { pluralize } from '../../lib/text';

/** How the workspace compares to its branch head, as the status bar words it. */
export type SyncState = { kind: 'upToDate'; label: string; tip: string } | { kind: 'behind'; count: number; label: string; tip: string };

export interface WorkspaceContext {
  /** The loaded changeset as users write it: `cs:240`. */
  changeset: string;
  /** Where that changeset comes from, in full, for its tooltip: "cs:240 on /main/task", "cs:11 · Label v1.0". */
  description: string;
  /** `repo@server`. */
  repository: string;
  /** Null while unknown, checked for another branch, or off a branch (nothing comes in). */
  sync: SyncState | null;
}

/**
 * What the status bar says about the workspace: its changeset and whether its branch moved on. The branch itself is
 * the top bar's, so it only shows in the changeset's tooltip.
 */
export function workspaceContext(info: WorkspaceInfo, summary: IncomingSummary | undefined): WorkspaceContext {
  const changeset = `cs:${info.loadedChangeset}`;
  const context = { changeset, repository: info.repository };
  if (info.selector.kind !== 'branch') {
    const name = workingObjectName(info.selector);
    const description = name === changeset ? changeset : `${changeset} · ${SELECTOR_KIND_LABELS[info.selector.kind]} ${name}`;
    return { ...context, description, sync: null };
  }

  const branch = info.selector.name;
  const description = `${changeset} on ${branch}`;
  if (!summary || summary.branch !== branch) return { ...context, description, sync: null };
  const count = summary.changesetCount;
  const sync: SyncState =
    count === 0
      ? { kind: 'upToDate', label: 'Up to date', tip: `Nothing new on ${branch}` }
      : { kind: 'behind', count, label: `${count} incoming`, tip: `${pluralize(count, 'new changeset')} on ${branch}: review them in Incoming` };
  return { ...context, description, sync };
}
