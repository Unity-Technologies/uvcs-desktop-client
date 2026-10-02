import type { ExternalApps } from '../domain/externalApps';

/** Editors and terminals to open files and folders in, opened only when the user asks. No `cm` call. */
export interface AppsApi {
  /** The editors and terminals installed here and the user's own, with the ones "Open in…" uses (looked for again after a minute). */
  list(): Promise<ExternalApps>;
  /** Opens a file or folder in the editor `editorId`, or in the user's editor when it's omitted. */
  openInEditor(path: string, editorId?: string): Promise<void>;
  /** Opens the terminal `terminalId` in a folder, or the user's terminal when it's omitted. */
  openInTerminal(folder: string, terminalId?: string): Promise<void>;
  /** Asks for a program (or macOS app) to open files in; the path picked, or null if cancelled. */
  pickProgram(): Promise<string | null>;
}
