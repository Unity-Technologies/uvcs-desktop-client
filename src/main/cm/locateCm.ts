import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

const WELL_KNOWN_LOCATIONS: Record<string, string[]> = {
  darwin: ['/usr/local/bin/cm', '/Applications/PlasticSCM.app/Contents/MacOS/cm', '/opt/homebrew/bin/cm'],
  linux: ['/usr/bin/cm', '/opt/plasticscm5/client/cm'],
  win32: ['C:\\Program Files\\PlasticSCM5\\client\\cm.exe', 'C:\\Program Files\\Unity VCS\\client\\cm.exe'],
};

export function locateCm(): string {
  const executable = process.platform === 'win32' ? 'cm.exe' : 'cm';
  const fromPath = (process.env.PATH ?? '')
    .split(delimiter)
    .map((dir) => join(dir, executable))
    .find(existsSync);

  return fromPath ?? WELL_KNOWN_LOCATIONS[process.platform]?.find(existsSync) ?? executable;
}
