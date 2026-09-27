import { join, relative, sep } from 'node:path';

/** Converts a workspace-relative path (forward slashes) into an absolute OS path. */
export function toAbsolutePath(workspacePath: string, relativePath: string): string {
  return join(workspacePath, ...relativePath.split('/'));
}

/** Converts an absolute OS path into a workspace-relative path with forward slashes. */
export function toRelativePath(workspacePath: string, absolutePath: string): string {
  return relative(workspacePath, absolutePath).split(sep).join('/');
}

/** A workspace-relative path as `cm` prints it (with backslashes on Windows) in the app's form, with forward slashes. */
export function fromCmRelativePath(path: string, platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? path.replaceAll('\\', '/') : path;
}
