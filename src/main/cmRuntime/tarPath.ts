import { win32 } from 'node:path';

/**
 * The `tar` that unpacks a bundle: the system's. On Windows, the one in System32 (bsdtar, there since Windows 10
 * 1803), which reads the Windows bundle's zip too; never the first `tar` on the PATH, which may be Git's GNU tar, which
 * doesn't. macOS's bsdtar and Linux's GNU tar read the other bundles' gzip by themselves.
 */
export function tarPath(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string {
  if (platform === 'win32') return win32.join(env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  return 'tar';
}
