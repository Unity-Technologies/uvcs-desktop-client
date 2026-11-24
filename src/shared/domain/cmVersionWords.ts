/**
 * How the app names a `cm`'s version to the user, the same everywhere it shows one (the update screen, Settings'
 * Command line client, `CmUnavailableScreen`): "Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later".
 */

/** The version installed on the computer: "Installed: 11.0.16.10700". */
export function installedVersionText(version: string): string {
  return `Installed: ${version}`;
}

/** The oldest version the app runs, the pinned one: "Needed: 11.0.16.10659 or later". */
export function neededVersionText(pinnedVersion: string): string {
  return `Needed: ${pinnedVersion} or later`;
}

/** The app's own version: "Included: 11.0.16.10659". */
export function includedVersionText(pinnedVersion: string): string {
  return `Included: ${pinnedVersion}`;
}

/** An installed version and the one needed, on one line: "Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later". */
export function installedAndNeededText(installedVersion: string, pinnedVersion: string): string {
  return `${installedVersionText(installedVersion)} · ${neededVersionText(pinnedVersion)}`;
}
