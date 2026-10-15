import { existsSync } from 'node:fs';
import { posix, win32 } from 'node:path';
import { pathFolders } from '../system/pathFolders';

/**
 * Where the installers put `cm`, by OS: the Windows installer in Program Files (`PlasticSCM5\client`, and a 32-bit
 * one in Program Files (x86)); the macOS one inside PlasticSCM.app, linked from /usr/local/bin; the Linux packages in
 * /opt/plasticscm5/client, linked from /usr/bin.
 */
function installLocations(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  if (platform === 'win32') {
    const folders = [env.ProgramFiles ?? 'C:\\Program Files', env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'];
    if (env.LOCALAPPDATA) folders.push(win32.join(env.LOCALAPPDATA, 'Programs'));
    return folders.flatMap((folder) => ['PlasticSCM5', 'Unity VCS'].map((product) => win32.join(folder, product, 'client', 'cm.exe')));
  }
  if (platform === 'darwin') {
    return [
      '/usr/local/bin/cm',
      '/opt/homebrew/bin/cm',
      '/Applications/PlasticSCM.app/Contents/Applications/cm.app/Contents/MacOS/cm',
      '/Applications/PlasticSCM.app/Contents/MacOS/cm',
    ];
  }
  return ['/usr/bin/cm', '/opt/plasticscm5/client/cm', '/usr/local/bin/cm'];
}

/**
 * Where to look for `cm`, in order: the PATH, then the install locations (an app started from the Dock or a desktop
 * menu may have a short PATH). It's started without a shell, so on Windows only `cm.exe` runs.
 */
export function cmCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  const join = platform === 'win32' ? win32.join : posix.join;
  return [...pathFolders(env, platform).map((folder) => join(folder, executableName(platform))), ...installLocations(platform, env)];
}

function executableName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'cm.exe' : 'cm';
}

/** Finds the `cm` executable (`UVCS_CM_PATH` overrides the search); its bare name when it's nowhere, so starting it fails with "not found". */
export function locateCm(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, exists: (path: string) => boolean = existsSync): string {
  if (env.UVCS_CM_PATH) return env.UVCS_CM_PATH;
  return cmCandidates(platform, env).find(exists) ?? executableName(platform);
}
