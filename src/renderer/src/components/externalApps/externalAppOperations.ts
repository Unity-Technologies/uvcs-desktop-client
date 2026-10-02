import { AUTO_APP, type CustomEditor } from '@shared/domain/externalApps';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { runRead } from '../../app/operations/runOperation';
import { queryClient } from '../../app/queryClient';
import { saveSettings } from '../../app/settings/useSettings';
import { programName } from '../../lib/programName';

/** Opens a file or folder on disk in the editor `editorId`, or in the user's editor. */
export function openInEditor(path: string, editorId?: string): Promise<void | undefined> {
  return runRead("Couldn't open it", () => api.apps.openInEditor(path, editorId));
}

/** Opens a terminal in a folder: `terminalId`, or the user's terminal. */
export function openInTerminal(folder: string, terminalId?: string): Promise<void | undefined> {
  return runRead("Couldn't open a terminal", () => api.apps.openInTerminal(folder, terminalId));
}

/**
 * Asks for an app, adds it to the editors so it's offered from then on, and opens the path in it (`open`, for a revision
 * saved first). Nothing when the user cancels, or the app couldn't be added.
 */
export async function openWithOtherApp(open: (editorId: string) => Promise<unknown>): Promise<void> {
  const id = await chooseEditor();
  if (id) await open(id);
}

/** Asks for an app and adds it to the editors; its id once saved, undefined when cancelled or not saved. */
export async function chooseEditor(): Promise<string | undefined> {
  const executable = await api.apps.pickProgram();
  if (!executable) return undefined;
  const existing = currentSettings().customEditors.find((editor) => editor.executable === executable);
  return existing?.id ?? addCustomEditor({ name: programName(executable), executable });
}

/** Makes the editor (or `auto`) the one "Open in…" uses. */
export function preferEditor(editorId: string): Promise<void> {
  return saveSettings({ editor: editorId });
}

/** Makes the terminal (or `auto`) the one "Open in…" uses. */
export function preferTerminal(terminalId: string): Promise<void> {
  return saveSettings({ terminal: terminalId });
}

/** Adds the user's app; its id once saved, undefined when the store couldn't save it (`saveSettings` says so). */
async function addCustomEditor(editor: Omit<CustomEditor, 'id'>): Promise<string | undefined> {
  const id = `custom:${Date.now()}`;
  await saveSettings({ customEditors: [...currentSettings().customEditors, { ...editor, id }] });
  return currentSettings().customEditors.some((saved) => saved.id === id) ? id : undefined;
}

/** Forgets an app the user added; when it was the one "Open in…" used, the automatic one takes over. */
export function removeCustomEditor(editorId: string): Promise<void> {
  const { customEditors, editor } = currentSettings();
  return saveSettings({ customEditors: customEditors.filter((custom) => custom.id !== editorId), ...(editor === editorId && { editor: AUTO_APP }) });
}

function currentSettings(): AppSettings {
  return queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS;
}
