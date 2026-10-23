import { rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processIsRunning } from '../system/processIsRunning';
import { removeFoldersOfGoneProcesses } from './goneProcessFolders';

export interface SessionFolderOptions {
  /** What its name starts with, before this process's id: `uvcs-revisions-`, `uvcs-trees-`. */
  prefix: string;
  /** The folder it is made in: the OS's temp folder. */
  tempFolder?: string;
  /** This process's id, and whether another is running: what tells a folder left over from one in use. */
  pid?: number;
  isRunning?: (pid: number) => boolean;
  /** Deletes the folder as the app quits; tests pass one that fails, as Windows may (a file held). */
  removeFolder?: (folder: string) => void;
}

/**
 * A folder of this session's own under the OS's temp folder (`<prefix><pid>-…`), made the first time it is asked for,
 * once the folders crashed sessions left are gone (`removeFoldersOfGoneProcesses`), never another running app's (a
 * development build beside the installed one). Deleted as the app quits (`dispose`); what Windows still holds stays
 * for the next session to delete.
 */
export class SessionFolder {
  private readonly prefix: string;
  private readonly tempFolder: string;
  private readonly pid: number;
  private readonly isRunning: (pid: number) => boolean;
  private readonly removeFolder: (folder: string) => void;
  private leftOvers: Promise<void> | null = null;
  private folder: Promise<string> | null = null;
  private made: string | null = null;

  constructor({ prefix, tempFolder = tmpdir(), pid = process.pid, isRunning = processIsRunning, removeFolder = (folder) => rmSync(folder, { recursive: true, force: true }) }: SessionFolderOptions) {
    this.prefix = prefix;
    this.tempFolder = tempFolder;
    this.pid = pid;
    this.isRunning = isRunning;
    this.removeFolder = removeFolder;
  }

  /** Deletes the folders sessions that are gone left with this prefix, once. */
  removeLeftOvers(): Promise<void> {
    this.leftOvers ??= removeFoldersOfGoneProcesses({ tempFolder: this.tempFolder, prefix: this.prefix, pid: this.pid, isRunning: this.isRunning });
    return this.leftOvers;
  }

  /** The folder, made the first time; made again on the next ask when making it failed. */
  path(): Promise<string> {
    this.folder ??= this.removeLeftOvers()
      .then(() => mkdtemp(join(this.tempFolder, `${this.prefix}${this.pid}-`)))
      .then(
        (made) => (this.made = made),
        (error: unknown) => {
          this.folder = null;
          throw error;
        },
      );
    return this.folder;
  }

  /** Deletes the folder, at once: the app is quitting. A file Windows still holds leaves it for the next session: quitting never fails for it. */
  dispose(): void {
    if (!this.made) return;
    try {
      this.removeFolder(this.made);
    } catch {
      // The next session deletes it (`removeLeftOvers`).
    }
  }
}
