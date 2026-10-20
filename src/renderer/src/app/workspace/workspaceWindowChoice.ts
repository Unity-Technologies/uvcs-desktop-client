import { api } from '../../api/client';

/** Where a workspace picked from a list opens: in this window, or in a new one beside it. */
export type WorkspaceWindowChoice = 'here' | 'newWindow';

/** Opens a workspace in the window asked for (`workspaceOpener`), as the workspace lists and their menus do. */
export type OpenWorkspaceIn = (path: string, where: WorkspaceWindowChoice) => void;

/** The modifiers held on a click or an Enter. */
type HeldModifiers = Pick<MouseEvent, 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>;

/**
 * Shift alone on a workspace's click or Enter (the home screen, the switcher, the palette) opens it in a new window:
 * the modifier Shift-dropping a folder uses (`app/folderDrop`), and the one that opens a link in a new window in the
 * browsers of macOS, Windows and Linux alike (⌘ or Ctrl would differ per OS). With another modifier held too it opens
 * here, as a plain click does. A missing workspace always opens here: its screen locates, recreates or forgets it,
 * nothing to work on beside another.
 */
export function windowAskedBy(event: HeldModifiers, { missing = false }: { missing?: boolean } = {}): WorkspaceWindowChoice {
  const shiftAlone = event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
  return shiftAlone && !missing ? 'newWindow' : 'here';
}

/**
 * Opens a workspace here with `openHere` (`useOpenWorkspace`), or in a new window: `windows.openWorkspace` brings
 * forward the window that already shows it instead (one window per workspace), and the new window remembers it as
 * recent as it opens it (`useRequestedWorkspace`).
 */
export function workspaceOpener(openHere: (path: string) => void): OpenWorkspaceIn {
  return (path, where) => {
    if (where === 'newWindow') void api.windows.openWorkspace(path);
    else openHere(path);
  };
}

/** What a palette result runs instead of its own `run` for the keys or click it got: its new window, with Shift. */
export function newWindowRunOf(result: { runInNewWindow?: () => void } | undefined, event: HeldModifiers): (() => void) | undefined {
  return windowAskedBy(event) === 'newWindow' ? result?.runInNewWindow : undefined;
}
