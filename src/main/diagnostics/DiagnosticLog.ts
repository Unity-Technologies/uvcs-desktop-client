import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { textForLog } from '../cm/hideSecrets';
import { logRecord } from './logRecords';
import { rotatesBefore, rotationRenames } from './logRotation';

/** What a part of the app needs to write to the log: one line of text (more lines for a stack or an output). */
export interface DiagnosticWriter {
  write(text: string): void;
}

/** The file operations the log runs, passed in so a test can make one fail. */
export interface LogFiles {
  /** The file's size in bytes, 0 when it doesn't exist yet. */
  size(path: string): Promise<number>;
  append(path: string, text: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}

export interface DiagnosticLogOptions {
  file: string;
  /** How big the current file grows before it becomes the first earlier one. */
  maxBytes: number;
  /** How many earlier files are kept beside it: the log takes at most `maxBytes` × (`keptFiles` + 1). */
  keptFiles: number;
  files?: LogFiles;
  now?: () => Date;
}

const NODE_LOG_FILES: LogFiles = {
  size: async (path) => {
    try {
      return (await stat(path)).size;
    } catch {
      return 0;
    }
  },
  // The logs folder may not exist yet: Electron names it (`app.getPath('logs')`) without making it.
  append: async (path, text) => {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, text, 'utf8');
  },
  rename,
};

/**
 * The app's log file, for a user to send with a bug report (ARCHITECTURE.md "The log file"). Each `write` is
 * a record, its secrets hidden (`textForLog`) and its time added (`logRecord`). Writing never blocks the caller nor
 * throws back at it: records wait in memory while the file is written, and go in one append when it's done. A file
 * that can't be written loses those records quietly; the log never writes about its own failures.
 */
export class DiagnosticLog implements DiagnosticWriter {
  private readonly files: LogFiles;
  private readonly now: () => Date;
  private waiting: string[] = [];
  /** The file's size as the log last knew it; unknown until it's read, and again after a failure. */
  private size: number | undefined;
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly options: DiagnosticLogOptions) {
    this.files = options.files ?? NODE_LOG_FILES;
    this.now = options.now ?? (() => new Date());
  }

  /** Where the log is written. */
  get file(): string {
    return this.options.file;
  }

  write(text: string): void {
    const when = this.now();
    this.waiting.push(logRecord(when, when.getTimezoneOffset(), textForLog(text)));
    // The first record waiting starts a write after the one running; later ones join it.
    if (this.waiting.length === 1) this.writing = this.writing.then(() => this.writeWaiting());
  }

  /** Settles once every record written so far is in the file (or lost to a failure). */
  flushed(): Promise<void> {
    return this.writing;
  }

  private async writeWaiting(): Promise<void> {
    const text = this.waiting.join('');
    this.waiting = [];
    const bytes = Buffer.byteLength(text, 'utf8');
    try {
      this.size ??= await this.files.size(this.options.file);
      if (rotatesBefore(this.size, bytes, this.options.maxBytes)) await this.rotate();
      await this.files.append(this.options.file, text);
      this.size += bytes;
    } catch {
      // The log helps diagnose a problem; failing to write it must never become one. Its size is read again next time.
      this.size = undefined;
    }
  }

  private async rotate(): Promise<void> {
    for (const { from, to } of rotationRenames(this.options.file, this.options.keptFiles)) {
      // An earlier file that doesn't exist yet (the log's first rotations) leaves nothing to move.
      await this.files.rename(from, to).catch(() => undefined);
    }
    this.size = 0;
  }
}
