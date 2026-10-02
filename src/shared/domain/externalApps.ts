/**
 * An app the user can open files and folders in (an editor, an IDE) or a folder in (a terminal): a well-known one found
 * on the machine, or one the user added. It opens only when the user asks.
 */
export interface ExternalApp {
  /** `vscode`, `rider`, `iterm`... for known apps; `custom:<n>` for the user's. */
  id: string;
  name: string;
  origin: 'known' | 'custom';
  /** Where it is (its app bundle, program or desktop entry), shown in Settings. */
  location: string;
  /** It opens a folder as a project. Terminals always do; a plain text editor doesn't. */
  opensFolders: boolean;
  /** The app's own icon as a data URL, when the OS gives one (macOS and Windows). */
  icon?: string;
}

/** The apps found, with the ones "Open in…" uses: the user's choice while it's there, else the automatic one. */
export interface ExternalApps {
  editors: ExternalApp[];
  terminals: ExternalApp[];
  /** Null when no editor is found, or the user opens each file with its default app (`SYSTEM_APP`). */
  editorId: string | null;
  /** Null when no terminal is found. */
  terminalId: string | null;
}

/** An app added by the user to open files in; known apps are found, not stored. */
export interface CustomEditor {
  id: string;
  name: string;
  /** The program, or the macOS app bundle, picked. */
  executable: string;
}

/** `auto`: the first editor found (in `KNOWN_EDITORS`' order); for terminals, the platform's usual one (`automaticTerminal`). */
export const AUTO_APP = 'auto';

/** The editor choice that opens each file with its default app, as the OS would: no editor (`editorId` null). */
export const SYSTEM_APP = 'system';
