import type { AppFileSystem } from '../../system/apps/appFileSystem';
import { pathFor, programFiles, type Whereabouts } from '../../system/apps/whereabouts';

/** A Unity Editor installed here. */
export interface UnityEditor {
  /** `6000.3.19f1`; empty for an install that doesn't say (one made without Unity Hub). */
  version: string;
  /** `Unity.app` on macOS; the `Editor` folder holding `Unity.exe` or `Unity` on Windows and Linux. */
  folder: string;
}

/**
 * The Unity Editors installed here, found the way Unity Hub keeps them: one folder per version in the Hub's editors
 * folder (its default one, and the one the user may have picked in the Hub instead, which the Hub records in
 * `secondaryInstallPath.json`), the editors the user located by hand in the Hub (`editors-v2.json`, `editors.json`
 * before it), and the single install of the days before the Hub. Only files are read: no process starts.
 */
export function findUnityEditors(where: Whereabouts, fs: AppFileSystem): UnityEditor[] {
  const path = pathFor(where);
  const inHubFolders = hubEditorFolders(where, fs).flatMap((folder) =>
    fs.list(folder).map((version) => ({ version, folder: path.join(folder, version, ...editorFolderInVersion(where)) })),
  );
  return [...inHubFolders, ...locatedInHub(where, fs), ...beforeTheHub(where)];
}

/** Where a Hub install keeps the editor, under its version's folder. */
function editorFolderInVersion(where: Whereabouts): string[] {
  return where.platform === 'darwin' ? ['Unity.app'] : ['Editor'];
}

/** The folders Unity Hub installs editors in: its default one, and the user's choice in its settings. */
function hubEditorFolders(where: Whereabouts, fs: AppFileSystem): string[] {
  const chosen = parseSecondaryInstallPath(fs.read(pathFor(where).join(hubConfigFolder(where), 'secondaryInstallPath.json')));
  return [defaultHubEditorFolder(where), ...(chosen ? [chosen] : [])];
}

function defaultHubEditorFolder(where: Whereabouts): string {
  if (where.platform === 'darwin') return '/Applications/Unity/Hub/Editor';
  if (where.platform === 'win32') return programFiles(where, 'Unity\\Hub\\Editor')[0]!;
  return pathFor(where).join(where.home, 'Unity', 'Hub', 'Editor');
}

/** Where Unity Hub keeps its settings, as Electron's `userData` for an app named UnityHub. */
function hubConfigFolder(where: Whereabouts): string {
  const path = pathFor(where);
  if (where.platform === 'darwin') return path.join(where.home, 'Library', 'Application Support', 'UnityHub');
  if (where.platform === 'win32') return path.join(where.env.APPDATA ?? path.join(where.home, 'AppData', 'Roaming'), 'UnityHub');
  return path.join(where.env.XDG_CONFIG_HOME ?? path.join(where.home, '.config'), 'UnityHub');
}

/** `secondaryInstallPath.json` holds one JSON string: the folder, or `""` while the Hub uses its default one. */
function parseSecondaryInstallPath(text: string | null): string | null {
  const folder = parseJson(text);
  return typeof folder === 'string' && folder.trim() ? folder.trim() : null;
}

/**
 * The editors located by hand in the Hub. Each names its program (`Unity.app` on macOS, `…\Editor\Unity.exe` on
 * Windows, `…/Editor/Unity` on Linux): its folder is the editor's.
 */
function locatedInHub(where: Whereabouts, fs: AppFileSystem): UnityEditor[] {
  const path = pathFor(where);
  const config = hubConfigFolder(where);
  const located = [...parseHubEditors(fs.read(path.join(config, 'editors-v2.json'))), ...parseHubEditors(fs.read(path.join(config, 'editors.json')))];
  return located.map(({ version, program }) => ({ version, folder: where.platform === 'darwin' ? program : path.dirname(program) }));
}

/**
 * The Hub's list of editors located by hand, in either of its shapes: `editors-v2.json` is
 * `{ "data": [{ "version", "location": [program] }] }`, the older `editors.json` `{ "<version>": { "version", "location" } }`.
 * Anything else reads as none.
 */
function parseHubEditors(text: string | null): { version: string; program: string }[] {
  const json = parseJson(text);
  if (!isObject(json)) return [];
  const entries = Array.isArray(json.data) ? json.data : Object.values(json);
  return entries.flatMap((entry) => {
    if (!isObject(entry) || typeof entry.version !== 'string') return [];
    const program = Array.isArray(entry.location) ? entry.location[0] : entry.location;
    return typeof program === 'string' && program ? [{ version: entry.version, program }] : [];
  });
}

/** The one editor installed without the Hub, where its installer put it; its version isn't in its path. */
function beforeTheHub(where: Whereabouts): UnityEditor[] {
  if (where.platform === 'darwin') return [{ version: '', folder: '/Applications/Unity/Unity.app' }];
  if (where.platform === 'win32') return [{ version: '', folder: programFiles(where, 'Unity\\Editor')[0]! }];
  return [];
}

function parseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
