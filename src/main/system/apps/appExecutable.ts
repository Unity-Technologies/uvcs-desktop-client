import { posix } from 'node:path';
import type { AppFileSystem } from './appFileSystem';

/**
 * The program to run for what the user picked: itself, or for a macOS app bundle its `CFBundleExecutable` (from an
 * XML Info.plist), else the one program in `Contents/MacOS` named like the bundle, else the first one there.
 */
export function appExecutable(picked: string, fs: AppFileSystem): string {
  if (!/\.app\/?$/.test(picked)) return picked;
  const bundle = picked.replace(/\/$/, '');
  const programs = posix.join(bundle, 'Contents', 'MacOS');
  const declared = /<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/.exec(fs.read(posix.join(bundle, 'Contents', 'Info.plist')) ?? '')?.[1];
  const named = bundle.split('/').pop()!.replace(/\.app$/, '');
  const candidates = [declared, named, ...fs.list(programs)].filter((name): name is string => Boolean(name)).map((name) => posix.join(programs, name));
  return candidates.find((candidate) => fs.exists(candidate)) ?? picked;
}
