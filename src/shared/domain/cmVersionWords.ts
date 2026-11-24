/**
 * How the app names a `cm`'s version to the user, the same everywhere it shows one (the update screen, Settings'
 * Command line client, `CmUnavailableScreen`): "Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later".
 */

/** A version on its own, where what it belongs to is named already (a Settings card): "Version 11.0.16.10700". */
export function versionText(version: string): string {
  return `Version ${version}`;
}

/** The version installed on the computer: "Installed: 11.0.16.10700". */
export function installedVersionText(version: string): string {
  return `Installed: ${version}`;
}

/** The oldest version the app runs, the pinned one: "Needed: 11.0.16.10659 or later". */
export function neededVersionText(pinnedVersion: string): string {
  return `Needed: ${pinnedVersion} or later`;
}

/** An installed version and the one needed, on one line: "Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later". */
export function installedAndNeededText(installedVersion: string, pinnedVersion: string): string {
  return `${installedVersionText(installedVersion)} · ${neededVersionText(pinnedVersion)}`;
}

/** A version too old and the one needed, where what it belongs to is named already: "Version 11.0.16.9000 · Needed: 11.0.16.10659 or later". */
export function versionAndNeededText(version: string, pinnedVersion: string): string {
  return `${versionText(version)} · ${neededVersionText(pinnedVersion)}`;
}

/** The version an update installs: "Installing: 11.0.16.10694". */
export function installingVersionText(version: string): string {
  return `Installing: ${version}`;
}

/** The version installed and the one its update installs: "Installed: 11.0.16.9000 · Installing: 11.0.16.10694". */
export function installedAndInstallingText(installedVersion: string, installingVersion: string): string {
  return `${installedVersionText(installedVersion)} · ${installingVersionText(installingVersion)}`;
}
