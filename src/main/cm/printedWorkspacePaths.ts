import { pathsOf, withForwardSlashes } from '../files/workspacePaths';

/**
 * Makes the absolute paths `cm` prints of a workspace's items (`cm status --machinereadable`) workspace-relative, with
 * forward slashes. `cm` writes each from the root it keeps for the workspace, which may be spelled apart from the
 * path the app has: another case on Windows and macOS, another composition of accents on macOS (`cm` writes names
 * decomposed). So the root is matched once, by its folders, against the first path, and every path after it starts
 * with what the first did: one comparison of its start each, for a million paths.
 */
export class PrintedWorkspacePaths {
  private readonly separator: string;
  private printedRoot: string;

  constructor(
    private readonly workspacePath: string,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {
    this.separator = pathsOf(platform).sep;
    this.printedRoot = asFolder(pathsOf(platform).normalize(workspacePath), this.separator);
  }

  /** `path` relative to the workspace, as Changes shows it (`src/app.ts`); fails for a path outside of it. */
  relative(path: string): string {
    if (!path.startsWith(this.printedRoot)) this.printedRoot = this.rootAsPrintedIn(path);
    return withForwardSlashes(path.slice(this.printedRoot.length), this.platform);
  }

  /** The start of `path` that names the workspace's root, however `cm` spelled it there (the root itself: all of it). */
  private rootAsPrintedIn(path: string): string {
    const rootFolders = this.printedRoot.split(this.separator).length - 1;
    const printedRoot = asFolder(path.split(this.separator).slice(0, rootFolders).join(this.separator), this.separator);
    if (comparable(printedRoot, this.platform) !== comparable(this.printedRoot, this.platform)) {
      throw new Error(`cm printed a path outside the workspace ${this.workspacePath}: ${path}`);
    }
    return printedRoot;
  }
}

function asFolder(path: string, separator: string): string {
  return path.endsWith(separator) ? path : path + separator;
}

/** As the OS compares paths: case ignored on Windows and macOS (whose disks ignore it by default), accents however composed on macOS. */
function comparable(path: string, platform: NodeJS.Platform): string {
  if (platform === 'win32') return path.toLowerCase();
  return platform === 'darwin' ? path.normalize('NFC').toLowerCase() : path;
}
