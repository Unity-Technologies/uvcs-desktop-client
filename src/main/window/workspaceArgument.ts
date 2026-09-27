import { pathsOf } from '../files/workspacePaths';

/**
 * The folder a launch of the installed app names, as Windows and Linux pass it (`Unity Version Control.exe C:\wk`, a
 * folder dropped on its icon, a desktop entry's `%f`): its last argument that isn't a switch, from the folder it was
 * run in. macOS sends `open-file` instead. Chromium may add switches of its own to a second launch's arguments.
 */
export function workspaceArgument(argv: readonly string[], workingDirectory: string, platform: NodeJS.Platform = process.platform): string | null {
  const named = argv.slice(1).filter((arg) => !arg.startsWith('-')).at(-1);
  return named ? pathsOf(platform).resolve(workingDirectory, named) : null;
}
