import type { FoundUpdate, UpdateFeed } from './AppUpdates';

/**
 * The environment variable that names a JSON file describing an update, for seeing What's New and the update card
 * while developing: an unpackaged app (`npm run app:debug`, `npm run dev`) finds that update instead of having no
 * feed. A packaged app ignores it. The file holds `{ "version": "0.2.5", "releaseDate": "…", "releaseNotes":
 * [{ "version": "0.2.5", "note": "<h2>New</h2>…" }] }`, each note as GitHub renders it (the HTML of `gh api
 * repos/<owner>/<repo>/releases/latest -H "Accept: application/vnd.github.html+json" --jq .body_html`).
 */
export const PREVIEW_UPDATE_VARIABLE = 'UVCS_PREVIEW_UPDATE';

/** The preview file the environment names, for an unpackaged app only; none when the variable is unset or blank. */
export function previewUpdateFile(isPackaged: boolean, env: Readonly<Record<string, string | undefined>>): string | undefined {
  const file = env[PREVIEW_UPDATE_VARIABLE]?.trim();
  return !isPackaged && file ? file : undefined;
}

/** The update a preview file describes; throws when the file isn't shaped as one. */
export function previewUpdateOf(json: unknown): FoundUpdate {
  if (!isRecord(json) || typeof json.version !== 'string') throw new Error(`${PREVIEW_UPDATE_VARIABLE}: the file names no "version".`);
  const notes = Array.isArray(json.releaseNotes) ? json.releaseNotes : [];
  return {
    version: json.version,
    files: [],
    releaseDate: typeof json.releaseDate === 'string' ? json.releaseDate : undefined,
    releaseNotes: notes.filter(isRecord).map((release) => ({ version: String(release.version), note: typeof release.note === 'string' ? release.note : null })),
  };
}

/**
 * A feed that finds `update` at once, downloads nothing, and never installs: quitting would only lose the session.
 * `createAppUpdates` skips what quitting to install prepares (`beforeRestart`), so the app keeps quitting as usual.
 */
export function previewUpdateFeed(update: FoundUpdate): UpdateFeed {
  return {
    checkForUpdates: async () => ({ isUpdateAvailable: true, updateInfo: update }),
    downloadUpdate: async () => undefined,
    quitAndInstall: () => console.warn(`[updates] ${PREVIEW_UPDATE_VARIABLE}: a preview update doesn't install.`),
    on: () => undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
