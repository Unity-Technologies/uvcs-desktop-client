import { readdirSync, readFileSync, statSync } from 'node:fs';

/** The little of the file system detecting apps needs, so tests can stand in for it. */
export interface AppFileSystem {
  /** A file, or a macOS app bundle (a folder ending in `.app`). */
  exists(path: string): boolean;
  /** The names in a folder; none if it can't be read. */
  list(folder: string): string[];
  /** A text file's content; null if it can't be read. */
  read(path: string): string | null;
}

export const diskFileSystem: AppFileSystem = {
  exists: (path) => {
    try {
      return statSync(path).isFile() || path.endsWith('.app');
    } catch {
      return false;
    }
  },
  list: (folder) => {
    try {
      return readdirSync(folder);
    } catch {
      return [];
    }
  },
  read: (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  },
};
