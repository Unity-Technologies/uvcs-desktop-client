import type { OfficialEdition } from './officialEdition';

/** The site the official client asks for its updates, and downloads them from. */
export const OFFICIAL_SITE = 'https://www.plasticscm.com';

/** The platforms the download site names: the Mac's by its own architecture. */
export type OfficialPlatform = 'windows' | 'macos' | 'macos-arm64' | 'linux';

/** The latest version of an edition, and where its installer downloads from (it redirects to the file). */
export interface OfficialRelease {
  version: string;
  installerUrl: string;
}

/**
 * The platform the download site names for this computer; null for an OS it has no installer for. The Mac's is its
 * own architecture, not the app's: an app running under Rosetta on Apple silicon still gets the Apple silicon
 * installer (`runsTranslated`, Electron's `app.runningUnderARM64Translation`), as the official client does. Windows has
 * one installer for x64 and Arm.
 */
export function officialPlatformOf(platform: NodeJS.Platform, arch: string, runsTranslated: boolean): OfficialPlatform | null {
  if (platform === 'win32') return 'windows';
  if (platform === 'darwin') return arch === 'arm64' || runsTranslated ? 'macos-arm64' : 'macos';
  if (platform === 'linux') return 'linux';
  return null;
}

/** The question the official client asks: the latest version after the installed one, of its edition and platform. */
export function lastVersionUrl(site: string, installedVersion: string, edition: OfficialEdition, platform: OfficialPlatform): string {
  const path = ['api', 'lastversion', 'after', installedVersion, 'for', edition, platform].map(encodeURIComponent).join('/');
  return `${site.replace(/\/+$/, '')}/${path}`;
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Whether the installer may download from `url`: over https, or from the site asked itself (`site`, a local fake site
 * in development: `UVCS_OFFICIAL_UPDATES_URL`). Never plain http elsewhere, nor a file or another scheme.
 */
export function isTrustedInstallerUrl(url: string, site: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.origin === new URL(site).origin;
  } catch {
    return false;
  }
}

/**
 * The latest version from the download site's answer (`lastVersionUrl`) to the question asked of `site`; null when
 * there's nothing newer (it answers `null`) or nothing usable. The installer's address is `installerUri`; an answer
 * without it has the download page, `…/download/<version>/…`, whose installer is `…/download/downloadinstaller/<version>/…`.
 * Only an address `isTrustedInstallerUrl` takes is usable.
 */
export function parseLastVersion(body: string, site: string): OfficialRelease | null {
  const release = readLastVersion(body);
  return release && isTrustedInstallerUrl(release.installerUrl, site) ? release : null;
}

/** The answer as the site gave it (`parseLastVersion` without the address check); null when there's nothing usable. */
export function readLastVersion(body: string): OfficialRelease | null {
  let answer: unknown;
  try {
    answer = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof answer !== 'object' || answer === null) return null;
  const { version, installerUri, downloadLink } = answer as Record<string, unknown>;
  const readableVersion = textOf(version);
  if (!readableVersion || !/^\d+(\.\d+)+$/.test(readableVersion)) return null;
  const installerUrl = textOf(installerUri) ?? textOf(downloadLink)?.replace('/download/', '/download/downloadinstaller/') ?? null;
  return installerUrl ? { version: readableVersion, installerUrl } : null;
}

/**
 * The name the installer is downloaded under: its version, edition and platform, with the extension the OS opens it by
 * (`unity-vcs-11.0.16.10694-cloud-windows.exe`, `unity-vcs-11.0.16.10694-cloud-macos-arm64.pkg.zip`). It's the app's own:
 * Electron's `net.fetch` doesn't tell the address a redirect ended at, where the site's name for it is. The version is
 * digits and dots (`parseLastVersion`), so no answer can name a file outside the folder it downloads into.
 */
export function installerFileName(version: string, edition: OfficialEdition, platform: OfficialPlatform): string {
  return `unity-vcs-${version}-${edition}-${platform}${platform === 'windows' ? '.exe' : '.pkg.zip'}`;
}
