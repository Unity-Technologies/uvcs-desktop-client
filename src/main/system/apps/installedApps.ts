import type { UninstallEntry } from './windowsRegistry';

/**
 * What the OS records about installed apps, read once for every app looked for (`readInstalledApps`): finding an app
 * by its identity (`locateInstall`) then only reads this and the file system. Linux keeps its records in files, read
 * as each app is looked for (`findDesktopEntry`).
 */
export interface InstalledApps {
  /** macOS: where each bundle identifier the catalogs name is installed, as Spotlight knows it. */
  bundles: ReadonlyMap<string, string>;
  /** Windows: the apps "Apps & features" lists. */
  uninstall: readonly UninstallEntry[];
  /** Windows: registered program paths by their lowercased `.exe` name. */
  appPaths: ReadonlyMap<string, string>;
}

export const NO_INSTALLED_APPS: InstalledApps = { bundles: new Map(), uninstall: [], appPaths: new Map() };

/** How long the records are trusted before an app installed meanwhile is looked for again. */
export const INSTALLED_APPS_RECHECK_MS = 60_000;

/**
 * The records, read when first needed and again once older than `INSTALLED_APPS_RECHECK_MS`, so the merge tools and
 * the apps to open files in share one read, and an app installed while the app runs shows up without a restart.
 * Calls while a read runs share it; a failed read counts as no records, and is tried again next time.
 */
export class InstalledAppsCache {
  private latest: { read: Promise<InstalledApps>; at: number } | null = null;

  constructor(
    private readonly read: () => Promise<InstalledApps>,
    private readonly now: () => number = Date.now,
  ) {}

  get(): Promise<InstalledApps> {
    if (!this.latest || this.now() - this.latest.at >= INSTALLED_APPS_RECHECK_MS) {
      const at = this.now();
      const read = this.read().catch(() => {
        if (this.latest?.read === read) this.latest = null;
        return NO_INSTALLED_APPS;
      });
      this.latest = { read, at };
    }
    return this.latest.read;
  }
}
