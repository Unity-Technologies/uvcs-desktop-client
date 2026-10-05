import { posix, win32 } from 'node:path';

/** What locating an app depends on: passed in, so detection is the same in tests on any OS. */
export interface Whereabouts {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  home: string;
  /** Where `cm` was found: the UVCS merge tool lives next to it on Windows. */
  cmPath: string;
}

/** The path module of the OS apps are looked for on, whatever OS runs the code. */
export function pathFor(where: Pick<Whereabouts, 'platform'>): typeof posix {
  return where.platform === 'win32' ? win32 : posix;
}

/** `bundlePath` in `/Applications` and `~/Applications`, where macOS apps are installed. */
export const macApps = (where: Whereabouts, bundlePath: string): string[] =>
  ['/Applications', posix.join(where.home, 'Applications')].map((folder) => posix.join(folder, bundlePath));

export const programFiles = (where: Whereabouts, path: string): string[] =>
  [where.env.ProgramFiles ?? 'C:\\Program Files', where.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'].map((folder) => win32.join(folder, path));

/** `%LOCALAPPDATA%\Programs`, where per-user Windows installers put apps. */
export const localPrograms = (where: Whereabouts, path: string): string[] =>
  where.env.LOCALAPPDATA ? [win32.join(where.env.LOCALAPPDATA, 'Programs', path)] : [];
