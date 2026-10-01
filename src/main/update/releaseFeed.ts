/**
 * The GitHub repository whose releases the app updates from; electron-builder.yml's `publish` names the same one (a
 * test checks it), which is where electron-updater reads `latest*.yml` and the release workflow uploads to.
 */
export const RELEASES_REPOSITORY = { owner: 'Unity-Technologies', repo: 'uvcs-desktop-client' };

export const REPOSITORY_URL = `https://github.com/${RELEASES_REPOSITORY.owner}/${RELEASES_REPOSITORY.repo}`;

/** Where a file of the release of `version` downloads from (electron-builder tags each release `v<version>`). */
export function releaseFileUrl(version: string, fileName: string): string {
  return `${REPOSITORY_URL}/releases/download/v${version}/${encodeURIComponent(fileName)}`;
}
