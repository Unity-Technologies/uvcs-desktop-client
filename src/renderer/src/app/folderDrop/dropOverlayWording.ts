import type { DraggedFolder } from '@shared/api/system';

/** What a drop will do, as far as the drag tells: unknown until main reads the drag (and on Windows and Linux). */
export type DropIntent = 'unknown' | 'open' | 'create';

export interface DropOverlayWording {
  icon: 'folder' | 'newWindow' | 'create';
  title: string;
  line: string;
  /** How Shift changes where the folder opens; none when the drop creates a workspace. */
  shift: { verb: 'Hold' | 'Release'; purpose: string } | null;
}

export function dropIntentOf(folder: DraggedFolder | null | undefined): DropIntent {
  if (!folder) return 'unknown';
  return folder.isWorkspace ? 'open' : 'create';
}

/** The overlay's words, as the official client says them once it knows what the folder is. */
export function dropOverlayWording(intent: DropIntent, newWindow: boolean): DropOverlayWording {
  if (intent === 'create') return { icon: 'create', title: 'Create workspace', line: 'Drop here to create a new workspace.', shift: null };
  const line = intent === 'open' ? 'Drop here to open.' : 'Drop a folder here.';
  if (newWindow) return { icon: 'newWindow', title: 'Open in a new window', line, shift: { verb: 'Release', purpose: 'to open it here.' } };
  const title = intent === 'open' ? 'Open workspace' : 'Open or create a workspace';
  return { icon: 'folder', title, line, shift: { verb: 'Hold', purpose: 'to open in a new window.' } };
}
