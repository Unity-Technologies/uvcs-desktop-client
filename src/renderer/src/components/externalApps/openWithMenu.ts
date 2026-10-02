import type { ExternalApp, ExternalApps } from '@shared/domain/externalApps';
import { api } from '../../api/client';
import { SEPARATOR, tidyMenu, type Action, type MenuEntry, type Submenu } from '../../lib/actions';
import type { GroupedEntry } from '../../lib/menuGroups';
import { menuAction, menuSubmenu } from '../menuWords';
import { openInEditor, openInTerminal, openWithOtherApp } from './externalAppOperations';
import { appIcon } from './appIcon';
import { currentExternalApps, defaultEditor, defaultTerminal } from './externalApps';

/** A file or folder on disk to open in another app. */
export interface DiskTarget {
  /** Its full path. */
  path: string;
  isFolder: boolean;
}

/** The app "Open in…" uses, in the "Open with" submenus: "Visual Studio Code (default)", as macOS' own Open With menu says. */
export function appLabel(app: ExternalApp, defaultId: string | null): string {
  return app.id === defaultId ? `${app.name} (default)` : app.name;
}

/**
 * The OS entries of anything on disk, in this order everywhere. A folder: "Open in <editor>" (when the user's editor
 * opens folders) and "Open in <terminal>", its two ways to open, then "Open with ▸" every app and "Reveal in Finder". A
 * file has Finder's: its menu's "Open" (the default app, as a double-click), then "Open with ▸" (the user's editor first,
 * marked) and "Reveal". Each entry earns its place: a file's "Open in <editor>" would read as a second "Open".
 */
export function openOnDiskEntries(target: DiskTarget, apps: ExternalApps = currentExternalApps()): (GroupedEntry & (Action | Submenu))[] {
  const editor = defaultEditor(apps);
  const terminal = defaultTerminal(apps);
  return [
    ...(target.isFolder && editor?.opensFolders ? [menuAction('openInEditor', () => void openInEditor(target.path, editor.id), { label: `Open in ${editor.name}` })] : []),
    ...(target.isFolder ? [menuAction('terminal', () => void openInTerminal(target.path), { label: terminal ? `Open in ${terminal.name}` : 'Open in terminal' })] : []),
    menuSubmenu('openWith', openWithEntries(target, apps)),
    menuAction('reveal', () => void api.system.revealInFileManager(target.path)),
  ];
}

/** Every editor that opens the item (and for a folder, every terminal), the defaults marked, then "Other app…". */
export function openWithEntries(target: DiskTarget, apps: ExternalApps): MenuEntry[] {
  const editors = apps.editors.filter((editor) => editor.opensFolders || !target.isFolder);
  return tidyMenu([
    ...editors.map((editor) => appEntry(editor, apps.editorId, () => void openInEditor(target.path, editor.id))),
    SEPARATOR,
    ...(target.isFolder ? apps.terminals.map((terminal) => appEntry(terminal, apps.terminalId, () => void openInTerminal(target.path, terminal.id))) : []),
    SEPARATOR,
    otherAppEntry((editorId) => openInEditor(target.path, editorId)),
  ]);
}

/** "Open this revision with ▸": every editor, then "Other app…"; `open` saves the revision and opens it in one. */
export function openRevisionWithSubmenu(open: (editorId: string) => Promise<unknown>, apps: ExternalApps = currentExternalApps()): GroupedEntry & Submenu {
  return menuSubmenu(
    'openRevisionWith',
    tidyMenu([...apps.editors.map((editor) => appEntry(editor, apps.editorId, () => void open(editor.id))), SEPARATOR, otherAppEntry(open)]),
  );
}

function appEntry(app: ExternalApp, defaultId: string | null, run: () => void): Action {
  const icon = appIcon(app);
  return { id: `openWith.${app.id}`, label: appLabel(app, defaultId), ...(icon && { icon }), run };
}

function otherAppEntry(open: (editorId: string) => Promise<unknown>): Action {
  return { id: 'openWith.other', label: 'Other app…', run: () => void openWithOtherApp(open) };
}
