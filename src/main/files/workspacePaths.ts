import { posix, win32 } from 'node:path';

/** The path functions of a platform: Windows paths on Windows, whatever OS runs the code. */
export function pathsOf(platform: NodeJS.Platform): typeof posix {
  return platform === 'win32' ? win32 : posix;
}

/** Converts a workspace-relative path (forward slashes) into an absolute OS path. */
export function toAbsolutePath(workspacePath: string, relativePath: string, platform: NodeJS.Platform = process.platform): string {
  return pathsOf(platform).join(workspacePath, ...relativePath.split('/'));
}

/** Converts workspace-relative paths into absolute OS paths, as `cm` takes them. */
export function toAbsolutePaths(workspacePath: string, relativePaths: readonly string[]): string[] {
  return relativePaths.map((path) => toAbsolutePath(workspacePath, path));
}

/** A workspace-relative path as `cm` writes it on this OS (`src\app.ts` on Windows), with forward slashes. */
export function withForwardSlashes(relativePath: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? relativePath.replaceAll('\\', '/') : relativePath;
}
