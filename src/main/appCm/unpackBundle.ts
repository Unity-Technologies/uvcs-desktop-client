import { spawn } from 'node:child_process';
import { win32 } from 'node:path';
import type { CmInstallFailure } from '@shared/domain/appCm';
import { CmInstallError } from './cmInstallFailure';

/**
 * The `tar` that unpacks a bundle: the system's. On Windows, the one in System32 (bsdtar, there since Windows 10
 * 1803), which reads the Windows bundle's zip too; never the first `tar` on the PATH, which may be Git's GNU tar, which
 * doesn't. macOS's bsdtar and Linux's GNU tar read the other bundles' gzip by themselves.
 */
export function tarPath(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string {
  if (platform === 'win32') return win32.join(env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  return 'tar';
}

/** A full disk stops tar as it writes; anything else that stops it is in the archive. */
function unpackFailure(errors: string): CmInstallFailure {
  return /no space left|not enough space/i.test(errors) ? 'diskFull' : 'damaged';
}

/** Unpacks an archive into an existing folder. A bundle that doesn't unpack fails as `damaged`, or `diskFull`. */
export function unpackBundle(archive: string, destination: string, platform: NodeJS.Platform, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(tarPath(platform, env), ['-xf', archive, '-C', destination], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.setEncoding('utf8').on('data', (text: string) => (errors += text));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new CmInstallError(unpackFailure(errors), `tar exited with ${code}: ${errors.trim()}`));
    });
  });
}
