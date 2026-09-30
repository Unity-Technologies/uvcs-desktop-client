import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Whether `codesign -dv --verbose=4` describes a Developer ID signature (it prints to stderr). */
export function isDeveloperIdSigned(codesignOutput: string): boolean {
  return /^Authority=Developer ID Application/m.test(codesignOutput);
}

/**
 * Whether this macOS app must be updated by hand. electron-updater installs through Squirrel.Mac, which checks the
 * download's signature against the running app's requirement: a build without a Developer ID signature (ad-hoc, or
 * none, when `codesign` fails) never passes ("code failed to satisfy specified code requirement(s)"). Such a build
 * downloads the disk image itself and the user drags it in (`AppUpdates`). `executablePath` is
 * `….app/Contents/MacOS/<name>`, three levels under the bundle.
 */
export async function needsManualInstall(executablePath: string): Promise<boolean> {
  const bundle = resolve(executablePath, '..', '..', '..');
  try {
    const { stdout, stderr } = await run('codesign', ['-dv', '--verbose=4', bundle]);
    return !isDeveloperIdSigned(`${stdout}${stderr}`);
  } catch {
    return true;
  }
}
