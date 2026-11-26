import { posix, win32 } from 'node:path';

/** The official installation's edition: the installer that updates it is that edition's (`lastVersionUrl`). */
export type OfficialEdition = 'cloud' | 'dvcs' | 'enterprise';

/**
 * The marker files the official installers leave next to the client, by edition, in the order they're looked for. The
 * enterprise edition (client only or full) leaves none. They are only checked for, never read: `cm` prints no edition,
 * and this is how the official client tells its own when it updates itself.
 */
const EDITION_MARKERS: readonly (readonly [file: string, edition: OfficialEdition])[] = [
  ['cloudedition.token', 'cloud'],
  ['dvcs.token', 'dvcs'],
];

/**
 * The folders that may hold the marker, for a `cm` whose links are resolved already: next to `cm` (Windows'
 * `<install>\client\`, Linux's `/opt/plasticscm5/client`); on macOS, inside the app bundle that holds `cm`
 * (PlasticSCM.app), where the installer puts it next to the `cm` it ships and the bundle's own executables.
 */
function markerFolders(cmPath: string, platform: NodeJS.Platform): string[] {
  if (platform === 'win32') return [win32.dirname(cmPath)];
  const bundle = /^(.*?\.app)(?:\/|$)/.exec(cmPath)?.[1];
  if (platform !== 'darwin' || !bundle) return [posix.dirname(cmPath)];
  return ['Contents/Applications/cm.app/Contents/MacOS', 'Contents/MonoBundle', 'Contents/MacOS'].map((folder) => posix.join(bundle, folder));
}

/** The edition of the official installation `cmPath` belongs to; `exists` only checks a file is there. */
export function officialEditionOf(cmPath: string, platform: NodeJS.Platform, exists: (path: string) => boolean): OfficialEdition {
  const join = platform === 'win32' ? win32.join : posix.join;
  const folders = markerFolders(cmPath, platform);
  const found = EDITION_MARKERS.find(([file]) => folders.some((folder) => exists(join(folder, file))));
  return found?.[1] ?? 'enterprise';
}
