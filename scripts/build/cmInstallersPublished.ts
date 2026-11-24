/**
 * Whether the official installers have published the pinned `cm` or newer, for every edition and platform the app
 * updates the installed one on (docs/features/cm-runtime.md "The pin"): a pin past them would bring up an update screen
 * whose Update finds nothing to install. `npm run cm:bump` and `npm run cm:check` ask the download site
 * (`scripts/build/cmVersion.ts`); the parts here only build the questions and read the answers.
 */
import { compareCmVersions } from '../../src/shared/domain/cmRuntime.ts';
import type { OfficialEdition } from '../../src/main/cmRuntime/officialUpdate/officialEdition.ts';
import { lastVersionUrl, parseLastVersion, type OfficialPlatform } from '../../src/main/cmRuntime/officialUpdate/officialRelease.ts';

/** Every edition, on every platform with an installer (Linux updates by its package manager: none to check). */
export const INSTALLER_TARGETS: readonly { edition: OfficialEdition; platform: OfficialPlatform }[] = (['cloud', 'enterprise', 'dvcs'] as const).flatMap((edition) =>
  (['windows', 'macos', 'macos-arm64'] as const).map((platform) => ({ edition, platform })),
);

export interface InstallerQuestion {
  edition: OfficialEdition;
  platform: OfficialPlatform;
  url: string;
}

/**
 * The version just before `version`, its last number one less: the site answers the latest version *after* the one
 * asked, so asking after this one names the pin itself when nothing newer is out.
 */
export function versionJustBefore(version: string): string {
  const numbers = version.split('.').map(Number);
  const last = numbers.at(-1)!;
  if (!(last > 0)) throw new Error(`${version} ends in 0: no version just before it to ask the download site after`);
  return [...numbers.slice(0, -1), last - 1].join('.');
}

/** What to ask the site at `site` for each edition and platform, so its answer shows whether `version` is out. */
export function installerQuestions(site: string, version: string): InstallerQuestion[] {
  const before = versionJustBefore(version);
  return INSTALLER_TARGETS.map(({ edition, platform }) => ({ edition, platform, url: lastVersionUrl(site, before, edition, platform) }));
}

/** The editions and platforms whose answer has nothing at `version` or newer, one line each; none when all have it. */
export function unpublishedInstallers(version: string, answers: readonly (InstallerQuestion & { body: string })[]): string[] {
  return answers.flatMap(({ edition, platform, url, body }) => {
    const release = parseLastVersion(body, new URL(url).origin);
    if (!release) return [`${edition} on ${platform}: nothing published after ${versionJustBefore(version)}`];
    return compareCmVersions(release.version, version) < 0 ? [`${edition} on ${platform}: the latest is ${release.version}`] : [];
  });
}
