import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withTempDirectory } from '../../files/tempFile';
import { NO_INSTALLED_APPS, type InstalledApps } from './installedApps';
import { bundleQueryArgs, parseBundleLocations } from './macBundles';
import { APP_PATHS_KEYS, appPaths, parseRegistryExport, uninstallEntries, UNINSTALL_KEYS, type RegistryKey } from './windowsRegistry';

/** Spotlight and `reg` answer in tens of milliseconds; one that hangs must not keep a menu from opening. */
const LOOKUP_TIMEOUT_MS = 5_000;

/**
 * Asks the OS which apps are installed: one `mdfind` for every bundle identifier on macOS, one `reg export` per key on
 * Windows (run side by side). Nothing on Linux, whose records are files (`findDesktopEntry`). The only processes the
 * app starts to find apps; nothing opens.
 */
export async function readInstalledApps(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string, bundleIds: string[]): Promise<InstalledApps> {
  if (platform === 'darwin') {
    const output = await run('mdfind', bundleQueryArgs(bundleIds)).catch(() => '');
    return { ...NO_INSTALLED_APPS, bundles: parseBundleLocations(output, home) };
  }
  if (platform === 'win32') {
    const [uninstall, programs] = await Promise.all([exportKeys(UNINSTALL_KEYS, env), exportKeys(APP_PATHS_KEYS, env)]);
    return { ...NO_INSTALLED_APPS, uninstall: uninstallEntries(uninstall), appPaths: appPaths(programs) };
  }
  return NO_INSTALLED_APPS;
}

/** The keys' subkeys and values; a key that doesn't exist (no 32-bit apps, nothing per user) adds none. */
function exportKeys(keys: string[], env: NodeJS.ProcessEnv): Promise<RegistryKey[]> {
  return withTempDirectory(async (directory) => {
    const exported = await Promise.all(
      keys.map(async (key, index) => {
        const file = join(directory, `${index}.reg`);
        try {
          await run('reg.exe', ['export', key, file, '/y']);
          // `reg export` writes UTF-16 with a byte order mark.
          return parseRegistryExport((await readFile(file)).toString('utf16le'), env);
        } catch {
          return [];
        }
      }),
    );
    return exported.flat();
  });
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: LOOKUP_TIMEOUT_MS, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
  });
}
