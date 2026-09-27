import { homedir } from 'node:os';
import { join, posix, win32 } from 'node:path';

/**
 * Where the official client keeps its settings (`UserConfigFolder`): `PLASTIC_HOME`, else the user's `plastic4`
 * folder: `%LOCALAPPDATA%\plastic4` on Windows, `~/.plastic4` on macOS and Linux.
 */
export function plasticConfigFolder(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string): string {
  if (env.PLASTIC_HOME) return env.PLASTIC_HOME;
  if (platform === 'win32') return win32.join(env.LOCALAPPDATA ?? win32.join(home, 'AppData', 'Local'), 'plastic4');
  return posix.join(home, '.plastic4');
}

/** A file in the official client's settings folder, e.g. `client.conf`. */
export function plasticConfigFile(name: string): string {
  return join(plasticConfigFolder(process.platform, process.env, homedir()), name);
}
