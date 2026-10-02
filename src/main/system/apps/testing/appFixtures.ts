import type { AppFileSystem } from '../appFileSystem';
import { NO_INSTALLED_APPS, type InstalledApps } from '../installedApps';
import type { UninstallEntry } from '../windowsRegistry';
import type { Whereabouts } from '../whereabouts';

export const mac: Whereabouts = { platform: 'darwin', env: { PATH: '/usr/bin:/usr/local/bin' }, home: '/Users/me', cmPath: '/usr/local/bin/cm' };
export const windows: Whereabouts = {
  platform: 'win32',
  env: { Path: 'C:\\Windows', LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local', ProgramFiles: 'C:\\Program Files', SystemRoot: 'C:\\Windows' },
  home: 'C:\\Users\\me',
  cmPath: 'C:\\Program Files\\PlasticSCM5\\client\\cm.exe',
};
export const linux: Whereabouts = { platform: 'linux', env: { PATH: '/usr/bin:/bin' }, home: '/home/me', cmPath: '/usr/bin/cm' };

/** A file system holding `paths` (programs, bundles) and text files with their content. */
export function fakeFileSystem(paths: string[], files: Record<string, string> = {}): AppFileSystem {
  const all = [...paths, ...Object.keys(files)];
  return {
    exists: (path) => all.includes(path),
    list: (folder) => [...new Set(all.filter((path) => path.startsWith(folder + (folder.includes('\\') ? '\\' : '/'))).map((path) => path.slice(folder.length + 1).split(/[\\/]/)[0]!))],
    read: (path) => files[path] ?? null,
  };
}

export function installedOnMac(bundles: Record<string, string>): InstalledApps {
  return { ...NO_INSTALLED_APPS, bundles: new Map(Object.entries(bundles)) };
}

export function installedOnWindows(uninstall: Partial<UninstallEntry>[], appPaths: Record<string, string> = {}): InstalledApps {
  return {
    ...NO_INSTALLED_APPS,
    uninstall: uninstall.map((entry) => ({ displayName: '', publisher: '', installLocation: '', displayIcon: '', ...entry })),
    appPaths: new Map(Object.entries(appPaths)),
  };
}
