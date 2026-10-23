import { repositoryPlace, workspacePathOf, workspacePlace, type Place } from '@shared/domain/place';
import type { WorkspaceHead, WorkspaceLocation, WorkspaceSelector, WorkspaceSummary } from '@shared/domain/workspace';
import { repositorySpec } from '@shared/domain/specs';
import { formatLink } from '@shared/links/formatLink';
import type { RepositoryLink, ServerLink, WorkspaceLink } from '@shared/links/link';
import { sameServer } from '@shared/links/linkSegments';
import { parseLink } from '@shared/links/parseLink';
import { api } from '../../api/client';
import { showInBranchExplorer } from '../../features/branchExplorer/branchExplorerStore';
import { useFilesViewStore } from '../../features/files/filesViewStore';
import { requestLineFocus } from '../../features/pendingChanges/changesLineFocus';
import { changeRowKey } from '../../features/pendingChanges/changeRows';
import { pendingChangesQuery } from '../../features/pendingChanges/usePendingChanges';
import { toast } from '../../ui/toast/toastStore';
import { useHomeSection } from '../home/homeSectionStore';
import { useProjectPickStore } from '../home/projectPickStore';
import { navigation } from '../navigation/navigationStore';
import { firstViewOf, showsView } from '../navigation/views';
import { selectInView } from '../navigation/viewSelectionStore';
import { queryClient } from '../queryClient';
import { settingsQuery } from '../settings/useSettings';
import { exploreHere } from '../workspace/exploreRepository';
import { openUnlessShownElsewhere } from '../workspace/useOpenWorkspace';
import { useSession } from '../workspace/sessionStore';
import { workspaceInfoQuery } from '../workspace/useWorkspace';
import { serversQuery, workspaceHeadsQuery, workspaceListQuery, workspaceRepositoryQuery } from '../workspace/workspaceQueries';
import { linkDestination, type WorkspaceOnRepository } from './linkDestination';
import { pickLinkWorkspace, showLinkFailure, type LinkWorkspaceChoice } from './linkDialogs';
import { linkLookup, linkNavigation, type LinkLooked, type LinkNavigation, type LinkTarget } from './linkNavigation';
import { serverLinkPlace } from './serverLinkPlace';

/**
 * Opens a `uvcs://` link in this window or the one for it (docs/features/deep-links.md, "Opening a link"): a link the
 * OS handed this window, one another window handed it, or one pasted in the palette. Says why when it can't.
 */
export async function openLink(text: string): Promise<void> {
  const reading = parseLink(text);
  if ('problem' in reading) return showLinkFailure(reading.problem);
  const { link } = reading;
  return toldIfFailed(() => {
    switch (link.kind) {
      case 'workspace':
        return openWorkspaceLink(link);
      case 'server':
        return openServerLink(link);
      case 'repository':
        return openRepositoryLink(link);
    }
  });
}

/**
 * A server's repositories, a Unity project's when the link names one, on the home screen: this window's when it shows
 * it, else another window's (`windows.openLinkAtHome`). No command beyond the list the home screen reads anyway.
 */
async function openServerLink(link: ServerLink): Promise<void> {
  if ((await api.windows.openLinkAtHome(formatLink(link))) === 'handedOver') return;
  const { server, project } = serverLinkPlace(link, await queryClient.fetchQuery(serversQuery));
  useProjectPickStore.getState().pick(server, project);
  useHomeSection.getState().show({ kind: 'server', server });
}

/** Runs what opens a link, telling in a toast when it fails (`cm` gone, the window closed meanwhile). */
async function toldIfFailed(open: () => Promise<void>): Promise<void> {
  try {
    await open();
  } catch (error) {
    toast.error("Couldn't open the link", error);
  }
}

async function openRepositoryLink(link: RepositoryLink): Promise<void> {
  const workspaces = await workspacesOnRepositories(link.repository);
  const current = useSession.getState().place;
  const destination = linkDestination(link, {
    current: current === null ? null : { repository: await repositoryOfShown(current) },
    workspaces,
    shown: await api.windows.shownWorkspaces(),
    recent: (await queryClient.fetchQuery(settingsQuery)).recentWorkspacePaths,
  });
  switch (destination.kind) {
    case 'here':
      return showHere(current!, link, link);
    case 'workspace':
      return openInWorkspace(destination.path, link);
    case 'pick': {
      const picked = await pickLinkWorkspace(link.repository, await workspaceChoices(destination.paths));
      if (picked) await openInWorkspace(picked, link);
      return;
    }
    case 'explore':
      return exploreFor(link);
  }
}

/** The repository of a place: a repository's own, a workspace's from its info. */
async function repositoryOfShown(place: Place): Promise<string> {
  return place.kind === 'repository' ? place.repository : (await queryClient.fetchQuery(workspaceInfoQuery(place.workspacePath))).repository;
}

function openInWorkspace(workspacePath: string, link: RepositoryLink): Promise<void> {
  const place = workspacePlace(workspacePath);
  return openIn(place, link, () => showHere(place, link, link));
}

/**
 * A link to a workspace on this computer: the workspace holding its folder, and a page in it; a file named without
 * one shows in Changes when it has changes, in Files otherwise.
 */
async function openWorkspaceLink(link: WorkspaceLink): Promise<void> {
  const location = await api.workspaces.locate(link.folder);
  if (!location) return showLinkFailure({ kind: 'notInWorkspace', folder: link.folder });
  const show = (): Promise<void> => showWorkspaceItem(location, link);
  return useSession.getState().workspacePath === location.root ? show() : openIn(workspacePlace(location.root), link, show);
}

/** What a workspace link opens in its workspace, this window's now. */
async function showWorkspaceItem({ root, itemPath: item }: WorkspaceLocation, link: WorkspaceLink): Promise<void> {
  const target: LinkTarget = link.page || !item ? link : { page: { kind: 'view', view: (await hasChange(root, item)) ? 'changes' : 'files', path: `/${item}` }, lines: link.lines };
  return showHere(workspacePlace(root), target, null);
}

/**
 * Hands the link to the window showing the place, or one opening it (`windows.openLinkIn`), as the app writes it;
 * this window opens the place, then shows the link, when it shows the home screen.
 */
async function openIn(place: Place, link: RepositoryLink | WorkspaceLink, showOnceOpen: () => Promise<void>): Promise<void> {
  if ((await api.windows.openLinkIn(place, formatLink(link))) === 'handedOver') return;
  if (place.kind === 'workspace') await openUnlessShownElsewhere(place.workspacePath, useSession.getState().openWorkspace);
  else await exploreHere(place.repository);
  return showOnceOpen();
}

/** Opens what the link names in this window's place, once what it needs is read (a label's changeset). */
async function showHere(place: Place, target: LinkTarget, link: RepositoryLink | null): Promise<void> {
  const lookup = linkLookup(target);
  const looked = lookup && (await readLookup(place, lookup));
  if (lookup && !looked) {
    const what = lookup.kind === 'label' ? `label ${lookup.name}` : `branch ${lookup.name}`;
    return showLinkFailure({ kind: 'notFound', what, repository: link?.repository ?? 'this repository' });
  }
  navigate(place, linkNavigation(target, looked || null));
}

async function readLookup(place: Place, lookup: NonNullable<ReturnType<typeof linkLookup>>): Promise<LinkLooked | null> {
  if (lookup.kind === 'label') {
    const label = await api.labels.get(place, lookup.name);
    return label && { changesetId: label.changeset };
  }
  const branch = await api.branches.get(place, lookup.name);
  return branch && { changesetId: branch.headChangeset };
}

/** Goes where the link leads in the place; a view the place doesn't show (a repository's Files) opens its first one. */
function navigate(place: Place, where: LinkNavigation): void {
  if (where.kind === 'page') return navigation.openPage(where.page);
  const { show } = where;
  if (show?.kind === 'branchExplorer') return showInBranchExplorer(show.target);
  if (!showsView(place, where.view)) return navigation.goToView(firstViewOf(place));
  const workspacePath = workspacePathOf(place);
  if (show?.kind === 'files') useFilesViewStore.getState().requestReveal(place, show.path);
  if (show?.kind === 'change' && workspacePath !== null) {
    selectInView(place, 'changes', changeRowKey(show.path));
    if (show.lines) requestLineFocus(workspacePath, show.path, show.lines);
  }
  navigation.goToView(where.view);
}

/**
 * Every workspace and its repository, from the local reads the home screen shares (`cm wi`). One `cm wi` names by an
 * organization's id only (`WorkspaceHead.repository` null) is asked again (`repositoryOf`), only when its repository's
 * own name is the link's: a few at most, never every workspace.
 */
async function workspacesOnRepositories(repositoryName: string): Promise<WorkspaceOnRepository[]> {
  const workspaces = await queryClient.fetchQuery(workspaceListQuery);
  const heads = await readHeads(workspaces);
  return Promise.all(
    workspaces.map(async ({ path }) => {
      const head = heads[path];
      if (!head || head.repository !== null) return { path, repository: head?.repository ?? null };
      const named = head.repositoryName.toLowerCase() === repositoryName.toLowerCase();
      return { path, repository: named ? await queryClient.fetchQuery(workspaceRepositoryQuery(path)) : null };
    }),
  );
}

async function readHeads(workspaces: readonly WorkspaceSummary[]): Promise<Record<string, WorkspaceHead>> {
  if (workspaces.length === 0) return {};
  return queryClient.fetchQuery(workspaceHeadsQuery(workspaces.map((workspace) => workspace.path)));
}

async function workspaceChoices(paths: readonly string[]): Promise<LinkWorkspaceChoice[]> {
  const workspaces = await queryClient.fetchQuery(workspaceListQuery);
  const heads = await readHeads(workspaces);
  return paths.map((path) => {
    const selector = heads[path]?.selector;
    const name = workspaces.find((workspace) => workspace.path === path)?.name ?? path;
    return selector ? { path, name, on: selectorWords(selector) } : { path, name };
  });
}

function selectorWords({ kind, name }: WorkspaceSelector): string {
  return kind === 'branch' ? name : `${kind} ${name}`;
}

/** Whether an item of the workspace has a pending change, from the list Changes reads anyway. */
async function hasChange(workspacePath: string, path: string): Promise<boolean> {
  const { pendingChanges: filter } = await queryClient.fetchQuery(settingsQuery);
  const { changes } = await queryClient.fetchQuery(pendingChangesQuery(workspacePath, filter));
  return changes.some((change) => change.path === path);
}

/**
 * Explores the repository without a workspace, as none is on it yet, then opens the link there as any link opens
 * (`openIn`): here when this window shows the home screen, else in the window exploring it or one of its own. The
 * server as the user's profiles name it (`ssl://host:8088`), which a link leaves the protocol out of.
 */
async function exploreFor(link: RepositoryLink): Promise<void> {
  const profiles = await api.repositories.servers();
  const server = profiles.find((profile) => sameServer(profile.server, link.server))?.server ?? link.server;
  const place = repositoryPlace(repositorySpec(link.repository, server));
  return openIn(place, link, () => showHere(place, link, link));
}
