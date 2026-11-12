import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import type { IncomingChanges, IncomingSummary, LoadedBranch, NothingIncoming, PartialBranch } from '@shared/domain/incoming';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { api } from '../../api/client';
import { queryKeys, workspaceKey } from '../../api/queryKeys';
import { keyedByWorkspaceInfo, queryClient } from '../../app/queryClient';
import { branchHeadMovedOnServer } from '../../app/refresh/headChanges';
import { refreshQueries } from '../../app/refresh/refreshQueries';
import { isAffectedByNewChangesets } from '../../app/refresh/refreshScopes';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { branchWorkedOn } from '../../components/workingObject';
import { notifyIncoming } from './incomingNotifications';
import { incomingPollInterval } from './incomingPollInterval';
import { incomingChangesKey } from './useIncomingChanges';

/** Coming back to the window checks again if the last check is older than this. */
const RECHECK_ON_FOCUS_AFTER_MS = 20_000;

/**
 * How many changesets the loaded branch has that the workspace doesn't. Incoming changes happen on the server, so
 * this is polled (every minute while the window has focus, every five behind other apps, never while hidden) and
 * checked again on focus. Each check is one light `cm find`: where the workspace stands comes from its workspace info,
 * which follows `.plastic`, and is part of the key, so an update or a switch checks again by itself. When someone
 * else checks in to the branch, the repository views refresh too, and an OS notification can tell the user (off by
 * default).
 *
 * A partial workspace loads no one changeset, so it can't count changesets: each check reads only where the branch head
 * is, and only when the head moved does it compare the loaded items with the head (`incomingChanges`, two listings), which
 * Incoming then shows without asking again.
 */
export function useIncomingSummary() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const loaded = workspace && loadedBranchOf(workspace);
  const pollInterval = useSyncExternalStore(onPresenceChange, currentPollInterval);
  return useQuery({
    queryKey: incomingSummaryKey(workspacePath, loaded),
    // Enabled once the workspace info is known: only then is `loaded` more than undefined.
    queryFn: ({ queryKey }) => checkIncoming(workspacePath, loaded as LoadedBranch, queryKey),
    enabled: loaded !== undefined,
    staleTime: RECHECK_ON_FOCUS_AFTER_MS,
    refetchOnWindowFocus: true,
    // Many components show it; the poll and the focus check keep it fresh, not their mounting.
    refetchOnMount: false,
    // Given as a value, so a window that gets hidden or loses focus re-arms its timer at once: the one armed before would still fire.
    refetchInterval: pollInterval,
    refetchIntervalInBackground: true,
    meta: keyedByWorkspaceInfo('loadedChangeset'),
  });
}

const currentPollInterval = () => incomingPollInterval(document.visibilityState === 'visible', document.hasFocus());

function onPresenceChange(changed: () => void): () => void {
  window.addEventListener('focus', changed);
  window.addEventListener('blur', changed);
  document.addEventListener('visibilitychange', changed);
  return () => {
    window.removeEventListener('focus', changed);
    window.removeEventListener('blur', changed);
    document.removeEventListener('visibilitychange', changed);
  };
}

/** Checks the server now, e.g. before updating. Undefined while the workspace info is unknown. */
export async function recheckIncoming(workspacePath: string): Promise<IncomingSummary | undefined> {
  const workspace = queryClient.getQueryData<WorkspaceInfo>(queryKeys.inWorkspace(workspacePath, 'info'));
  if (!workspace) return undefined;
  const loaded = loadedBranchOf(workspace);
  const queryKey = incomingSummaryKey(workspacePath, loaded);
  return queryClient.fetchQuery({ queryKey, queryFn: () => checkIncoming(workspacePath, loaded, queryKey), staleTime: 0 });
}

function incomingSummaryKey(workspacePath: string, loaded: LoadedBranch | undefined) {
  return queryKeys.inWorkspace(workspacePath, 'incoming', 'summary', loaded);
}

function loadedBranchOf({ selector, loadedChangeset }: WorkspaceInfo): LoadedBranch {
  const branch = branchWorkedOn(selector);
  if (branch === undefined) return null;
  // On a branch, only a partial workspace loads no one changeset (a shelve has none either, but is no branch).
  return loadedChangeset === null ? { branch, partial: true } : { branch, loadedChangeset };
}

async function checkIncoming(workspacePath: string, loaded: LoadedBranch, queryKey: readonly unknown[]): Promise<IncomingSummary> {
  const before = queryClient.getQueryData<IncomingSummary>(queryKey);
  const after = loaded && 'partial' in loaded ? await checkPartialIncoming(workspacePath, loaded) : await api.merge.incomingSummary(workspacePath, loaded);
  if (before && branchHeadMovedOnServer(before, after)) {
    void refreshQueries({ queryKey: workspaceKey(workspacePath), predicate: (query) => isAffectedByNewChangesets(query.queryKey) });
    void notifyIncoming(workspacePath, before, after);
  }
  return after;
}

const NOTHING_INCOMING: NothingIncoming = { branch: null, changesetCount: 0, countCapped: false, authors: [] };

/**
 * Where the head of a partial workspace's branch is, and how many of its items it would change. The comparison is the
 * one Incoming shows (`incomingChangesKey`), read again only when the head moved or an operation refreshed it (an
 * update brings items without moving the head), and shared with a read Incoming already has under way.
 */
async function checkPartialIncoming(workspacePath: string, { branch }: PartialBranch): Promise<IncomingSummary> {
  const headChangeset = await api.merge.branchHead(workspacePath, branch);
  if (headChangeset === null) return NOTHING_INCOMING;
  const changes = await queryClient.fetchQuery<IncomingChanges>({
    queryKey: incomingChangesKey(workspacePath),
    queryFn: () => api.merge.incomingChanges(workspacePath),
    staleTime: (query) => (comparedWithHead(query.state.data, branch, headChangeset) ? Infinity : 0),
  });
  return 'partial' in changes ? { branch, partial: true, headChangeset: changes.headChangeset, itemCount: changes.items.length } : NOTHING_INCOMING;
}

function comparedWithHead(changes: IncomingChanges | undefined, branch: string, headChangeset: number): boolean {
  return changes !== undefined && 'partial' in changes && changes.branch === branch && changes.headChangeset === headChangeset;
}
