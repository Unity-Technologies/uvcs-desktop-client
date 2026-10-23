import { workspacePlace } from '@shared/domain/place';
import type { ContentSource, RepositoryVersion } from '@shared/domain/content';
import type { ExternalApps } from '@shared/domain/externalApps';
import { openInEditor, openWithDefaultApp } from '../../../components/externalApps/externalAppOperations';
import { openRevisionWithEntries, type OpenIn } from '../../../components/externalApps/openWithMenu';
import { menuAction } from '../../../components/menuWords';
import { SEPARATOR, type MenuEntry, type Submenu } from '../../../lib/actions';
import { extensionOf, fileNameOf } from '../../../lib/text';
import { openVersion } from '../../history/revisionOperations';
import { absolutePath } from '../../pendingChanges/pendingChangeOperations';
import type { MergeLabels } from '../mergeDescription';
import type { FileConflictState } from './useFileConflicts';

/** One version of a conflicting file: each side's, and the base. */
export type ConflictVersion = 'destination' | 'source' | 'base';

/** What opening a conflict's versions needs, wherever it is resolved: the merge page and Incoming. */
export interface VersionOpeningContext {
  workspacePath: string;
  labels: MergeLabels;
  /** "Yours" is the workspace file (a merge into the workspace, an update), not the destination's version on the server. */
  yoursInWorkspace: boolean;
}

/** A version of a conflicting file that can be opened in another app, named as the merge names it. */
export interface OpenableVersion {
  version: ConflictVersion;
  /** "Yours", "Incoming" ("Destination", "Source" merging into a server branch), "Base". */
  label: string;
  open: OpenIn;
}

/**
 * The versions of a conflicting file that can be opened, in the order the menus list them: yours, incoming, and the
 * base, each only when there is one (a file added on both sides has no base). Yours in a workspace is the workspace
 * file itself; every other version is saved from the repository first, under a name that tells which it is
 * (`versionCopyName`): two versions open side by side in one app would otherwise look alike. Nothing is read to list them.
 */
export function openableVersions(state: Pick<FileConflictState, 'file'>, { workspacePath, labels, yoursInWorkspace }: VersionOpeningContext): OpenableVersion[] {
  const { file } = state;
  const fromRepository = (version: ContentSource, label: string): OpenIn | undefined =>
    version.kind === 'empty' ? undefined : (editorId) => openVersion(workspacePlace(workspacePath), version as RepositoryVersion, versionCopyName(file.path, label), editorId);
  const workspaceFile = absolutePath(workspacePath, file.path);
  const yours: OpenIn | undefined = yoursInWorkspace
    ? (editorId) => (editorId ? openInEditor(workspaceFile, editorId) : openWithDefaultApp(workspaceFile))
    : fromRepository(file.destination, labels.roles.destination.name);
  const candidates: { version: ConflictVersion; label: string; open: OpenIn | undefined }[] = [
    { version: 'destination', label: labels.roles.destination.name, open: yours },
    { version: 'source', label: labels.roles.source.name, open: fromRepository(file.source, labels.roles.source.name) },
    { version: 'base', label: 'Base', open: fromRepository(file.base, 'Base') },
  ];
  return candidates.flatMap(({ open, ...version }) => (open ? [{ ...version, open }] : []));
}

/**
 * The app a version opens in with one click ("Open version ▸ Incoming"): a text in the user's editor, as every file
 * opens; a binary with its default app, since the editors are for text (a PSD opens in Photoshop, not in VS Code).
 */
export function oneClickApp(state: Pick<FileConflictState, 'isBinary' | 'file'>, apps: ExternalApps): string | null {
  return opensAsBinary(state) ? null : apps.editorId;
}

/**
 * Whether a conflict's versions open as a binary's: known to be one by its revision's type (`isKnownBinary`), or by its
 * bytes once read. A binary `cm` keeps as text counts as text until its versions are read.
 */
export function opensAsBinary(state: Pick<FileConflictState, 'isBinary' | 'file'>): boolean {
  return state.isBinary || state.file.isKnownBinary === true;
}

/**
 * The apps to open one version of a binary in, as one list (a card's menu, a version's submenu): "Open", with its
 * default app, then every app ("Open with"'s entries: `openRevisionWithEntries`), another app, and the apps' settings.
 * No editor is marked as the default one: here the default is the file's own app.
 */
export function versionAppEntries(open: OpenIn, apps: ExternalApps): MenuEntry[] {
  return [menuAction('open', () => void open(null), { label: 'Open' }), SEPARATOR, ...openRevisionWithEntries(open, { ...apps, editorId: null })];
}

/** A submenu per version, each listing the apps to open it in (`versionAppEntries`): "Open version"'s menu for a binary. */
export function versionsMenu(versions: OpenableVersion[], apps: ExternalApps): Submenu[] {
  return versions.map(({ version, label, open }) => ({ id: `openVersion.${version}`, label, entries: versionAppEntries(open, apps) }));
}

/**
 * The name a version is saved under to open it: the file's own name with the version's label before its extension
 * (`hero.INCOMING.psd`), as the merge tools get them, so the OS still picks the app by the extension.
 */
export function versionCopyName(path: string, label: string): string {
  // A name already near the file systems' 255-character limit fails to save with ENAMETOOLONG, and the toast says so:
  // such names are rare enough not to cut, which would also cut what tells the versions apart.
  const name = fileNameOf(path);
  const extension = extensionOf(name);
  const tag = label.toUpperCase();
  return extension ? `${name.slice(0, -extension.length)}.${tag}${extension}` : `${name}.${tag}`;
}
