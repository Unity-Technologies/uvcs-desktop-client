import { homedir } from 'node:os';
import { join } from 'node:path';

/** Where the official client keeps its settings (`UserConfigFolder`): `PLASTIC_HOME`, else the user's `plastic4` folder. */
export function plasticConfigFile(name: string): string {
  const folder =
    process.env.PLASTIC_HOME ||
    (process.platform === 'win32' ? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'plastic4') : join(homedir(), '.plastic4'));
  return join(folder, name);
}
