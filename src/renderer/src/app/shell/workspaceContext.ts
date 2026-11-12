import type { IncomingSummary, PartialIncoming } from '@shared/domain/incoming';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { SELECTOR_KIND_LABELS, workingObjectName } from '../../components/workingObject';
import { formatCountAtLeast, pluralizeAtLeast } from '../../lib/text';

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
  /** Null on a shelve, whose tree is no changeset and which is itself the working object, and in a partial workspace. */
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
  if (summary && 'partial' in summary) return { changeset: null, repository, sync: partialSyncState(summary) };
  if (loadedChangeset === null) return { changeset: null, repository, sync: null };
  const spec = `cs:${loadedChangeset}`;
  if (selector.kind !== 'branch') {
    const name = workingObjectName(selector);
    const description = name === spec ? spec : `${spec} · ${SELECTOR_KIND_LABELS[selector.kind]} ${name}`;
    return { changeset: { id: loadedChangeset, spec, description }, repository, sync: null };
  }

  const branch = selector.name;
  const changeset = { id: loadedChangeset, spec, description: `${spec} on ${branch}` };
  if (!summary || summary.branch !== branch || 'partial' in summary) return { changeset, repository, sync: null };
  const { changesetCount: count, countCapped } = summary;
  return { changeset, repository, sync: syncState(branch, count, countCapped, 'new changeset') };
}

/** A partial workspace loads no one changeset: what its branch head brings is the items it would change. */
function partialSyncState({ branch, itemCount }: PartialIncoming): SyncState {
  return syncState(branch, itemCount, false, 'item', 'changed');
}

function syncState(branch: string, count: number, countCapped: boolean, noun: string, verb = ''): SyncState {
  if (count === 0) return { kind: 'upToDate', label: 'Up to date', tip: `Nothing new on ${branch}` };
  const what = pluralizeAtLeast(count, countCapped, noun) + (verb && ` ${verb}`);
  return { kind: 'behind', count, label: `${formatCountAtLeast(count, countCapped)} incoming`, tip: `${what} on ${branch}: review them in Incoming` };
}
