import type { AboutPanelOptionsOptions } from 'electron';

/**
 * What Help › About shows off macOS (Linux's GTK dialog, Windows' message box), which read none of it from the app:
 * without it, Linux says "About electron", without a version. macOS reads the app bundle.
 */
export function aboutPanelOptions(name: string, version: string): AboutPanelOptionsOptions {
  return { applicationName: name, applicationVersion: version };
}
