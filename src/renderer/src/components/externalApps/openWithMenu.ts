import { FolderOpen, Settings } from 'lucide-react';
import type { ExternalApp, ExternalApps } from '@shared/domain/externalApps';
import { api } from '../../api/client';
import { openSettingsDialogAt } from '../../app/settings/SettingsDialog';
import { SEPARATOR, tidyMenu, type Action, type MenuEntry, type Submenu } from '../../lib/actions';
import type { GroupedEntry } from '../../lib/menuGroups';
import { menuAction, menuSubmenu } from '../menuWords';
import { openFile, openInEditor, openInTerminal, openWithDefaultApp, openWithOtherApp } from './externalAppOperations';
import { openWorkspaceInFileManager } from '../../app/workspace/workspaceShellActions';
import { appIcon } from './appIcon';
import { currentExternalApps, defaultEditor, defaultTerminal } from './externalApps';

/** A file or folder on disk to open in another app. */
export interface DiskTarget {
  /** Its full path. */
  path: string;
  isFolder: boolean;
  /** The workspace's own folder: the file manager opens it, since its parent folder isn't the workspace's. */
  isWorkspace?: boolean;
}

/** The app "Open in…" uses, in the "Open with" submenus: "Visual Studio Code (default)", as macOS' own Open With menu says. */
export function appLabel(app: ExternalApp, defaultId: string | null): string {
  return app.id === defaultId ? `${app.name} (default)` : app.name;
}

/**
 * The opening entries of anything on disk, first in its menu and in this order everywhere. A file: "Open in <editor>"
 * (plain "Open", its default app, when the user has no editor), what Enter and a double-click do too; then "Open with ▸"
 * and "Reveal in Finder". A folder: "Open in <editor>" (when the user's editor opens folders) and "Open in <terminal>",
 * its two ways to open (its default app would only show it in Finder); then "Open with ▸" and "Reveal", or for the
 * workspace's own folder "Open in Finder" (`isWorkspace`), which shows what it holds rather than its parent's.
 */
export function openOnDiskEntries(target: DiskTarget, apps: ExternalApps = currentExternalApps()): (GroupedEntry & (Action | Submenu))[] {
  const editor = defaultEditor(apps);
  const terminal = defaultTerminal(apps);
  const opening = target.isFolder
    ? [
        ...(editor?.opensFolders ? [menuAction('openInEditor', () => void openInEditor(target.path, editor.id), { label: `Open in ${editor.name}` })] : []),
        menuAction('terminal', () => void openInTerminal(target.path), { label: terminal ? `Open in ${terminal.name}` : 'Open in terminal' }),
      ]
    : [menuAction('open', () => void openFile(target.path, apps), { label: editor ? `Open in ${editor.name}` : 'Open' })];
  const fileManager = target.isWorkspace
    ? menuAction('openInFileManager', () => openWorkspaceInFileManager(target.path))
    : menuAction('reveal', () => void api.system.revealInFileManager(target.path));
  return [...opening, menuSubmenu('openWith', openWithEntries(target, apps)), fileManager];
}

/**
 * Every editor that opens the item (and for a folder, every terminal), the defaults marked; for a file opened in an
 * editor, its default app too; then another app, and the apps' settings.
 */
export function openWithEntries(target: DiskTarget, apps: ExternalApps): MenuEntry[] {
  const editors = apps.editors.filter((editor) => editor.opensFolders || !target.isFolder);
  return tidyMenu([
    ...editors.map((editor) => appEntry(editor, apps.editorId, () => void openInEditor(target.path, editor.id))),
    SEPARATOR,
    ...(target.isFolder ? apps.terminals.map((terminal) => appEntry(terminal, apps.terminalId, () => void openInTerminal(target.path, terminal.id))) : []),
    ...(!target.isFolder && apps.editorId ? [defaultAppEntry(() => void openWithDefaultApp(target.path))] : []),
    SEPARATOR,
    ...otherAppEntries((editorId) => openInEditor(target.path, editorId)),
  ]);
}

/**
 * A revision's opening entries: "Open this revision in <editor>" (plain, with its default app, when the user has no
 * editor), then "Open this revision with ▸". `open` saves the revision and opens it in an editor, or with its default
 * app for `null`.
 */
export function openRevisionEntries(open: (editorId: string | null) => Promise<unknown>, apps: ExternalApps = currentExternalApps()): (GroupedEntry & (Action | Submenu))[] {
  const editor = defaultEditor(apps);
  return [
    menuAction('openRevision', () => void open(editor?.id ?? null), { label: editor ? `Open this revision in ${editor.name}` : 'Open this revision' }),
    menuSubmenu(
      'openRevisionWith',
      tidyMenu([
        ...apps.editors.map((app) => appEntry(app, apps.editorId, () => void open(app.id))),
        SEPARATOR,
        ...(editor ? [defaultAppEntry(() => void open(null))] : []),
        SEPARATOR,
        ...otherAppEntries(open),
      ]),
    ),
  ];
}

function appEntry(app: ExternalApp, defaultId: string | null, run: () => void): Action {
  const icon = appIcon(app);
  return { id: `openWith.${app.id}`, label: appLabel(app, defaultId), ...(icon && { icon }), run };
}

/** The file's own default app, as the OS would open it, when the user's editor opens files otherwise. */
function defaultAppEntry(run: () => void): Action {
  return { id: 'openWith.system', label: 'Default app', run };
}

/** "Choose another app…" adds one and opens the item in it, as the merge tools' menu words it; "Manage apps…" leads to the apps' settings. */
function otherAppEntries(open: (editorId: string) => Promise<unknown>): Action[] {
  return [
    { id: 'openWith.other', label: 'Choose another app…', icon: FolderOpen, run: () => void openWithOtherApp(open) },
    { id: 'openWith.manage', label: 'Manage apps…', icon: Settings, run: () => openSettingsDialogAt('apps') },
  ];
}
