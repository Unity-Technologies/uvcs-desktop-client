/** A file of a release, as `latest-mac.yml` lists it (electron-updater's `UpdateFileInfo`). */
export interface ReleaseFile {
  url: string;
  sha512: string;
  size?: number;
}

/**
 * The disk image of a release for this Mac, which the user installs by hand when the app can't install it itself
 * (`needsManualInstall`). `latest-mac.yml` lists every architecture's zip and dmg, and electron-updater hands the whole
 * list over: its first file is whichever built first (x64), which would run the whole app under Rosetta on Apple
 * silicon. The names carry the architecture (`-macOS-arm64.dmg`, electron-builder.yml's `artifactName`), and an x64
 * build already running under Rosetta (`translated`) moves to arm64 with it. Null when the release has no such image.
 */
export function installerAsset(files: readonly ReleaseFile[], arch: string, translated: boolean): ReleaseFile | null {
  const hostArch = translated ? 'arm64' : arch;
  return files.find((file) => file.url.endsWith(`-macOS-${hostArch}.dmg`)) ?? null;
}
