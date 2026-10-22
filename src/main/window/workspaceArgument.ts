import { pathsOf } from '../files/workspacePaths';
import { isLinkLaunch } from '../links/linkArgument';

/**
 * The folder a launch of the installed app names, as Windows and Linux pass it (`Unity Version Control.exe C:\wk`, a
 * folder dropped on its icon, a desktop entry's `%f`): its last argument that isn't a switch, from the folder it was
 * run in. macOS sends `open-file` instead. Chromium may add switches of its own to a second launch's arguments. A
 * launch for a `uvcs://` link names no folder (`linkArgument`): its command line holds the link alone.
 */
export function workspaceArgument(argv: readonly string[], workingDirectory: string, platform: NodeJS.Platform = process.platform): string | null {
  if (isLinkLaunch(argv)) return null;
  const named = argv.slice(1).filter((arg) => !arg.startsWith('-')).at(-1);
  return named ? pathsOf(platform).resolve(workingDirectory, named) : null;
}
