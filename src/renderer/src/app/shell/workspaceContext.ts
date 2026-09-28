import type { IncomingSummary } from '@shared/domain/incoming';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { SELECTOR_KIND_LABELS, workingObjectName } from '../../components/workingObject';
import { pluralize } from '../../lib/text';

/** How the workspace compares to its branch head, as the status bar words it. */
export type SyncState = { kind: 'upToDate'; label: string; tip: string } | { kind: 'behind'; count: number; label: string; tip: string };

/** The loaded changeset, as the status bar shows it. */
export interface LoadedChangeset {
  id: number;
  /** As users write it: `cs:240`. */
  spec: string;
  /** Where it comes from, in full, for its tooltip: "cs:240 on /main/task", "cs:11 · Label v1.0". */
  description: string;
}

export interface WorkspaceContext {
  /** Null on a shelve: its tree is no changeset, and the shelve itself is the working object. */
  changeset: LoadedChangeset | null;
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
  const { repository, selector, loadedChangeset } = info;
  if (loadedChangeset === null) return { changeset: null, repository, sync: null };
  const spec = `cs:${loadedChangeset}`;
  if (selector.kind !== 'branch') {
    const name = workingObjectName(selector);
    const description = name === spec ? spec : `${spec} · ${SELECTOR_KIND_LABELS[selector.kind]} ${name}`;
    return { changeset: { id: loadedChangeset, spec, description }, repository, sync: null };
  }

  const branch = selector.name;
  const changeset = { id: loadedChangeset, spec, description: `${spec} on ${branch}` };
  if (!summary || summary.branch !== branch) return { changeset, repository, sync: null };
  const count = summary.changesetCount;
  const sync: SyncState =
    count === 0
      ? { kind: 'upToDate', label: 'Up to date', tip: `Nothing new on ${branch}` }
      : { kind: 'behind', count, label: `${count} incoming`, tip: `${pluralize(count, 'new changeset')} on ${branch}: review them in Incoming` };
  return { changeset, repository, sync };
}
