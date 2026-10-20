import { itemNameProblem } from '../files/itemName';

/** A path typed in "Restore to…" as the workspace-relative path it names: trimmed, and with `/` for Windows' `\`. */
export function typedRestorePath(typed: string, platform: string): string {
  const trimmed = typed.trim();
  return platform === 'win32' ? trimmed.replaceAll('\\', '/') : trimmed;
}

/** Why a typed path can't take a restored item, as far as the renderer can tell: main checks the disk. */
export function restorePathProblem(typed: string, platform: string): string | undefined {
  const leading = typed.trim()[0];
  if (leading === '/' || (platform === 'win32' && leading === '\\')) return `A path in the workspace starts with a folder or a name, not “${leading}”`;
  return itemNameProblem(typedRestorePath(typed, platform), [], { allowFolders: true });
}
