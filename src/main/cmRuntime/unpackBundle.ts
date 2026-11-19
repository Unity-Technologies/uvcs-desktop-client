import { spawn } from 'node:child_process';
import { dirname, relative, win32 } from 'node:path';
import type { CmInstallFailure } from '@shared/domain/cmRuntime';
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

/**
 * Why tar stopped. The archive was checked as published before (its SHA-256), so what stops it is this computer: a
 * full disk, a folder it can't write, or else something that didn't let it (`blocked`).
 */
export function unpackFailure(errors: string): CmInstallFailure {
  if (/no space left|not enough space/i.test(errors)) return 'diskFull';
  if (/permission denied|access is denied|read-only file system/i.test(errors)) return 'notWritable';
  return 'blocked';
}

/**
 * Unpacks an archive into an existing folder (`unpackFailure` says why it couldn't). tar runs in the archive's folder
 * and is given the names relative to it, plain ASCII (`11.0.16.10659.partial`): no user's folder name, accents or
 * spaces in it, reaches tar's command line, whose code page Windows may not agree with.
 */
export function unpackBundle(archive: string, destination: string, platform: NodeJS.Platform, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const cwd = dirname(archive);
    const args = ['-xf', relative(cwd, archive), '-C', relative(cwd, destination) || '.'];
    const child = spawn(tarPath(platform, env), args, { cwd, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.setEncoding('utf8').on('data', (text: string) => (errors += text));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new CmInstallError(unpackFailure(errors), `tar exited with ${code}: ${errors.trim()}`));
    });
  });
}
