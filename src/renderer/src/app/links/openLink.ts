import { workspacePlace } from '@shared/domain/place';
import type { WorkspaceHead, WorkspaceLocation, WorkspaceSelector, WorkspaceSummary } from '@shared/domain/workspace';
import { repositorySpec } from '@shared/domain/specs';
import { formatLink } from '@shared/links/formatLink';
import type { RepositoryLink, WorkspaceLink } from '@shared/links/link';
import { sameServer } from '@shared/links/linkSegments';
import { parseLink } from '@shared/links/parseLink';
import { api } from '../../api/client';
import { showInBranchExplorer } from '../../features/branchExplorer/branchExplorerStore';
import { useFilesViewStore } from '../../features/files/filesViewStore';
import { requestLineFocus } from '../../features/pendingChanges/changesLineFocus';
import { changeRowKey } from '../../features/pendingChanges/changeRows';
import { pendingChangesQuery } from '../../features/pendingChanges/usePendingChanges';
import { toast } from '../../ui/toast/toastStore';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { navigation } from '../navigation/navigationStore';
import { selectInView } from '../navigation/viewSelectionStore';
import { queryClient } from '../queryClient';
import { settingsQuery } from '../settings/useSettings';
import { openUnlessShownElsewhere } from '../workspace/useOpenWorkspace';
import { useSession } from '../workspace/sessionStore';
import { workspaceInfoQuery } from '../workspace/useWorkspace';
import { workspaceHeadsQuery, workspaceListQuery, workspaceRepositoryQuery } from '../workspace/workspaceQueries';
import { linkDestination, type WorkspaceOnRepository } from './linkDestination';
import { offerNewWorkspace, pickLinkWorkspace, showLinkFailure, type LinkWorkspaceChoice } from './linkDialogs';
import { linkLookup, linkNavigation, type LinkLooked, type LinkNavigation, type LinkTarget } from './linkNavigation';

/**
 * Opens a `uvcs://` link in this window or the one for it (docs/features/deep-links.md, "Opening a link"): a link the
 * OS handed this window, one another window handed it, or one pasted in the palette. Says why when it can't.
 */
export async function openLink(text: string): Promise<void> {
  const reading = parseLink(text);
  if ('problem' in reading) return showLinkFailure(reading.problem);
  const { link } = reading;
  return toldIfFailed(() => (link.kind === 'workspace' ? openWorkspaceLink(link) : openRepositoryLink(link)));
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
  const current = useSession.getState().workspacePath;
  const destination = linkDestination(link, {
    current: current === null ? null : { path: current, repository: (await queryClient.fetchQuery(workspaceInfoQuery(current))).repository },
    workspaces,
    shown: await api.windows.shownWorkspaces(),
    recent: (await queryClient.fetchQuery(settingsQuery)).recentWorkspacePaths,
  });
  switch (destination.kind) {
    case 'here':
      return showHere(current!, link, link);
    case 'workspace':
      return openIn(destination.path, link, () => showHere(destination.path, link, link));
    case 'pick': {
      const picked = await pickLinkWorkspace(link.repository, await workspaceChoices(destination.paths));
      if (picked) await openIn(picked, link, () => showHere(picked, link, link));
      return;
    }
    case 'none':
      return createWorkspaceFor(link);
  }
}

/**
 * A link to a workspace on this computer: the workspace holding its folder, and a page in it; a file named without
 * one shows in Changes when it has changes, in Files otherwise.
 */
async function openWorkspaceLink(link: WorkspaceLink): Promise<void> {
  const location = await api.workspaces.locate(link.folder);
  if (!location) return showLinkFailure({ kind: 'notInWorkspace', folder: link.folder });
  const show = (): Promise<void> => showWorkspaceItem(location, link);
  return useSession.getState().workspacePath === location.root ? show() : openIn(location.root, link, show);
}

/** What a workspace link opens in its workspace, this window's now. */
async function showWorkspaceItem({ root, itemPath: item }: WorkspaceLocation, link: WorkspaceLink): Promise<void> {
  const target: LinkTarget = link.page || !item ? link : { page: { kind: 'view', view: (await hasChange(root, item)) ? 'changes' : 'files', path: `/${item}` }, lines: link.lines };
  return showHere(root, target, null);
}

/**
 * Hands the link to the window showing the workspace, or one opening it (`windows.openLinkIn`), as the app writes it;
 * this window opens the workspace, then shows the link, when it shows the home screen.
 */
async function openIn(workspacePath: string, link: RepositoryLink | WorkspaceLink, showOnceOpen: () => Promise<void>): Promise<void> {
  if ((await api.windows.openLinkIn(workspacePath, formatLink(link))) === 'handedOver') return;
  await openUnlessShownElsewhere(workspacePath, useSession.getState().openWorkspace);
  return showOnceOpen();
}

/** Opens what the link names in this window's workspace, once what it needs is read (a label's changeset). */
async function showHere(workspacePath: string, target: LinkTarget, link: RepositoryLink | null): Promise<void> {
  const lookup = linkLookup(target);
  const looked = lookup && (await readLookup(workspacePath, lookup));
  if (lookup && !looked) {
    const what = lookup.kind === 'label' ? `label ${lookup.name}` : `branch ${lookup.name}`;
    return showLinkFailure({ kind: 'notFound', what, repository: link?.repository ?? 'this repository' });
  }
  navigate(workspacePath, linkNavigation(target, looked || null));
}

async function readLookup(workspacePath: string, lookup: NonNullable<ReturnType<typeof linkLookup>>): Promise<LinkLooked | null> {
  if (lookup.kind === 'label') {
    const label = await api.labels.get(workspacePath, lookup.name);
    return label && { changesetId: label.changeset };
  }
  const branch = await api.branches.get(workspacePlace(workspacePath), lookup.name);
  return branch && { changesetId: branch.headChangeset };
}

function navigate(workspacePath: string, where: LinkNavigation): void {
  if (where.kind === 'page') return navigation.openPage(where.page);
  const { show } = where;
  if (show?.kind === 'branchExplorer') return showInBranchExplorer(show.target);
  if (show?.kind === 'files') useFilesViewStore.getState().requestReveal(workspacePath, show.path);
  if (show?.kind === 'change') {
    selectInView(workspacePath, 'changes', changeRowKey(show.path));
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
 * Offers to create a workspace on the repository, then opens the link in it as any link opens (`openIn`): here when
 * this window shows the home screen, else in a window of its own. The server as the user's profiles name it
 * (`ssl://host:8088`), which a link leaves the protocol out of.
 */
async function createWorkspaceFor(link: RepositoryLink): Promise<void> {
  if (!(await offerNewWorkspace(link.repository))) return;
  const profiles = await api.repositories.servers();
  const server = profiles.find((profile) => sameServer(profile.server, link.server))?.server ?? link.server;
  openCreateWorkspaceDialog({
    repository: { id: '', name: link.repository, server, owner: '', spec: repositorySpec(link.repository, server) },
    // The dialog calls it and goes: it tells its own failure.
    onCreated: (workspacePath) => toldIfFailed(() => openIn(workspacePath, link, () => showHere(workspacePath, link, link))),
  });
}
