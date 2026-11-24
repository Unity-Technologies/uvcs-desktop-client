/**
 * The buttons of the screens and cards about the Unity Version Control the app runs (the setup screen, the update
 * screen, `CmUnavailableScreen`, Settings' Command line client cards, the update card's), in title case as every
 * button of the app is ("Check Again", "Restart & Install"): one place, so the same action reads the same everywhere.
 */

export const TRY_AGAIN_LABEL = 'Try Again';

/** Updates the installed one with its installer. */
export const UPDATE_LABEL = 'Update';

/** Runs the app's own instead of updating the installed one, until the app needs a newer one again. */
export const USE_INCLUDED_FOR_NOW_LABEL = 'Use the Included Version for Now';

/** Reads the installed one's version again; "Checking…" while it does. */
export function checkAgainLabel(checking: boolean): string {
  return checking ? 'Checking…' : 'Check Again';
}

/** Runs the installed one instead of the app's own, which couldn't be set up: "Use the Installed Version (11.0.16.10700)". */
export function useInstalledLabel(version: string): string {
  return `Use the Installed Version (${version})`;
}
