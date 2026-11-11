import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceKind } from '@shared/domain/workspace';
import type { OptionCard } from '../../../ui/OptionCards';

/** What the dialog reads of a repository: its name and spec (a server's listed one, or one explored without a workspace). */
export type NamedRepository = Pick<RepositorySummary, 'name' | 'spec'>;
import { lastSegment } from '../../../lib/paths';
import { defaultWorkspacePath, isWorkspaceNameTaken, repositoryNamed, repositoryNamedButForCase, suggestWorkspaceName } from '../workspaceNaming';

/** What "Learn more" next to the dynamic choice opens: Unity's page on dynamic workspaces. */
export const DYNAMIC_WORKSPACES_URL = 'https://docs.unity.com/en-us/unity-version-control/dynamic-workspaces';

/**
 * The kind after the user ticks or clears one kind's checkbox: ticking one chooses it (dynamic and partial exclude each
 * other), clearing the chosen one goes back to standard, and clearing one not chosen changes nothing.
 */
export function toggledKind(current: WorkspaceKind, kind: Exclude<WorkspaceKind, 'standard'>, checked: boolean): WorkspaceKind {
  if (checked) return kind;
  return current === kind ? 'standard' : current;
}

/** What the workspace downloads: the whole branch (a standard or dynamic workspace), or only the folders the user picks (partial). */
export type DownloadChoice = 'branch' | 'folders';

/**
 * The kind after the user chooses what to download: only some folders makes it partial; the whole branch makes a
 * partial choice standard and keeps a dynamic one, which downloads the whole branch too.
 */
export function kindForDownloads(current: WorkspaceKind, choice: DownloadChoice): WorkspaceKind {
  if (choice === 'folders') return 'partial';
  return current === 'partial' ? 'standard' : current;
}

/**
 * The "What to download" cards, saying when to choose each: they tell new users what the official client told them by
 * shipping a separate app for partial workspaces. Each line says only what `cm` holds to: a partial workspace can't
 * merge (`cm merge` asks to convert it to standard first) and switches only to branches.
 */
export function downloadCards(form: Pick<NewWorkspaceForm, 'partialAllowed'>): OptionCard<DownloadChoice>[] {
  return [
    { value: 'branch', title: 'The whole branch', description: 'Every file, at one changeset. Switch and merge freely.' },
    {
      value: 'folders',
      title: 'Only the folders I pick',
      description: form.partialAllowed
        ? 'Less to download; each file updates on its own. Merging needs the whole branch. Pick the folders next, and change them anytime.'
        : 'Not for a new repository: it has nothing to pick yet.',
      disabled: !form.partialAllowed,
    },
  ];
}

/** The repository a new workspace works with, as the dialog's Repository field resolves it. */
export type WorkspaceRepository =
  | { kind: 'existing'; spec: string }
  /** `created` is the spec of the repository an earlier try made before its workspace failed: only the workspace is left. */
  | { kind: 'new'; server: string; name: string; created?: string };

/** What the New workspace dialog holds: what the user chose and typed, and what it read. */
export interface NewWorkspaceFormInput {
  server: string;
  /** The Repository field as typed or picked from its suggestions. */
  repositoryName: string;
  /** The repositories on `server`; undefined until read. */
  repositories: readonly NamedRepository[] | undefined;
  /** Reading the repositories on `server` failed. */
  repositoriesFailed: boolean;
  /** The spec of the repository an earlier try made before its workspace failed. */
  created: string | undefined;
  /** What the user typed in the workspace name field; undefined until they type. */
  typedName: string | undefined;
  /** A folder the dialog was opened with: the workspace goes there, named after it. */
  initialPath: string | undefined;
  workspaceNames: readonly string[];
  /** A folder the user chose or typed for the workspace. */
  chosenPath: string | undefined;
  /** The folder new workspaces go in. */
  root: string | undefined;
  /** This computer can create dynamic workspaces (`api.workspaces.canCreateDynamic`); false until told. */
  dynamicAvailable: boolean;
  /** The kind the user chose with the dialog's download cards and dynamic checkbox. */
  kindChosen: WorkspaceKind;
  creating: boolean;
}

/** What the New workspace dialog shows and allows. */
export interface NewWorkspaceForm {
  /** Undefined until the Repository field names one that can be used. */
  repository: WorkspaceRepository | undefined;
  /** Whether the server's repositories, which the Repository field suggests, are being read, couldn't be, or are. */
  repositoryList: 'loading' | 'failed' | 'ready';
  /** The name typed is none of the server's repositories: one is created with the workspace. */
  createsRepository: boolean;
  /** What the Repository field notes under it: a repository will be created, or one is named like it but for case. */
  repositoryNote: { kind: 'creates' } | { kind: 'differsByCase'; existingName: string } | undefined;
  /** An earlier try made the repository: the server and repository can no longer change. */
  repositoryLocked: boolean;
  workspaceName: string;
  workspaceNameTaken: boolean;
  path: string;
  /** Whether the dialog offers to make the workspace dynamic: only where this computer can mount one. */
  offersDynamic: boolean;
  /** The workspace is created dynamic: chosen, and offered. */
  dynamic: boolean;
  /** The dynamic checkbox can't be ticked: only the folders picked are downloaded, and a dynamic workspace has the whole branch. */
  dynamicDisabled: boolean;
  /**
   * Whether "Only the folders I pick" can be chosen: not for a repository the dialog creates, which has nothing to pick
   * from. It can be while no repository is named yet, so the choice reads the same from the start.
   */
  partialAllowed: boolean;
  /** The workspace is created partial, with nothing downloaded until the user chooses: chosen, and allowed. */
  partial: boolean;
  /** The download card selected. */
  downloads: DownloadChoice;
  /** The kind the workspace is created as: the one chosen if offered, else standard. */
  kind: WorkspaceKind;
  canCreate: boolean;
}

export function newWorkspaceFormOf(input: NewWorkspaceFormInput): NewWorkspaceForm {
  const repository = repositoryOf(input);
  const workspaceName = workspaceNameShown(input);
  const workspaceNameTaken = isWorkspaceNameTaken(workspaceName, input.workspaceNames);
  const path = input.chosenPath ?? defaultWorkspacePath(input.root, workspaceName);
  const createsRepository = repository?.kind === 'new' && !repository.created;
  const partialAllowed = repository?.kind !== 'new';
  const partial = partialAllowed && input.kindChosen === 'partial';
  const dynamic = input.dynamicAvailable && input.kindChosen === 'dynamic';
  return {
    repository,
    repositoryList: input.repositoriesFailed ? 'failed' : input.repositories ? 'ready' : 'loading',
    createsRepository,
    repositoryNote: createsRepository ? noteOnCreating(input) : undefined,
    repositoryLocked: input.created !== undefined,
    workspaceName,
    workspaceNameTaken,
    path,
    offersDynamic: input.dynamicAvailable,
    dynamic,
    dynamicDisabled: partial,
    partialAllowed,
    partial,
    downloads: partial ? 'folders' : 'branch',
    kind: dynamic ? 'dynamic' : partial ? 'partial' : 'standard',
    canCreate: Boolean(repository && workspaceName.trim() && path && !workspaceNameTaken && !input.creating),
  };
}

/**
 * What the Repository field starts with: the repository the caller fixed, else the name of the folder the dialog opened
 * with (a dropped folder), as the workspace is named after it too; that names the server's repository of that name, or
 * proposes one to create, as the official client does.
 */
export function initialRepositoryName(fixed: NamedRepository | undefined, initialPath: string | undefined): string {
  return fixed?.name ?? (initialPath ? lastSegment(initialPath) : '');
}

/** The server whose repositories the dialog reads (to suggest them, and to tell a new name); none when the caller fixed the repository. */
export function serverToList(server: string, fixed: NamedRepository | undefined): string | null {
  return fixed ? null : server;
}

/** The repositories the Repository field can name: the one the caller fixed, else the server's as read. */
export function repositoriesToName(fixed: NamedRepository | undefined, listed: readonly NamedRepository[] | undefined): readonly NamedRepository[] | undefined {
  return fixed ? [fixed] : listed;
}

/**
 * A name the server has is that repository; any other is one to create. `cm` tells repository names apart by case, so
 * only the exact name matches. Until the list is read nothing can be told, so nothing is named.
 */
function repositoryOf({ server, repositoryName, repositories, created }: NewWorkspaceFormInput): WorkspaceRepository | undefined {
  const name = repositoryName.trim();
  if (created) return { kind: 'new', server, name, created };
  if (!name || !repositories) return undefined;
  const existing = repositoryNamed(name, repositories);
  return existing ? { kind: 'existing', spec: existing.spec } : { kind: 'new', server, name };
}

/** A name that differs only by case from a repository's is likely a slip: it is told apart from a plainly new name. */
function noteOnCreating({ repositoryName, repositories }: NewWorkspaceFormInput): NewWorkspaceForm['repositoryNote'] {
  const lookalike = repositoryNamedButForCase(repositoryName, repositories ?? []);
  return lookalike ? { kind: 'differsByCase', existingName: lookalike.name } : { kind: 'creates' };
}

/** What the user typed, else the folder's name, else a name after the repository. */
function workspaceNameShown({ typedName, initialPath, repositoryName, workspaceNames }: NewWorkspaceFormInput): string {
  if (typedName !== undefined) return typedName;
  if (initialPath) return lastSegment(initialPath);
  const name = repositoryName.trim();
  return name ? suggestWorkspaceName(name, workspaceNames) : '';
}
