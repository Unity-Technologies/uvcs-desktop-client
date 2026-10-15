/** A discard written to a workspace file: its text before and after. */
export interface Discard {
  before: string;
  after: string;
}

/**
 * The characters of text the undo history keeps, both texts of every discard (about twice as many bytes): a few
 * discards in big files, many in small ones.
 */
export const MAX_DISCARD_HISTORY_CHARS = 8_000_000;

interface Recorded {
  key: string;
  workspacePath: string;
  discard: Discard;
}

/**
 * The discards made to each workspace file in this window, so they can be undone one after another (newest first),
 * whatever diff they were made in. Each keeps the whole file's text before and after: past `maxChars` the oldest of
 * any file go, never the newest; a workspace the window leaves takes its own with it (`forgetWorkspace`).
 */
export class DiscardHistory {
  /** Every file's discards, oldest first. */
  private recorded: Recorded[] = [];
  private chars = 0;

  constructor(private readonly maxChars = MAX_DISCARD_HISTORY_CHARS) {}

  record(workspacePath: string, path: string, discard: Discard): void {
    this.recorded.push({ key: keyOf(workspacePath, path), workspacePath, discard });
    this.chars += charsOf(discard);
    while (this.chars > this.maxChars && this.recorded.length > 1) {
      const [oldest] = this.recorded.splice(0, 1);
      this.chars -= charsOf(oldest.discard);
    }
  }

  /** The file's newest discard still kept. */
  last(workspacePath: string, path: string): Discard | undefined {
    const key = keyOf(workspacePath, path);
    return this.recorded.findLast((entry) => entry.key === key)?.discard;
  }

  /** The discard was undone. */
  forget(workspacePath: string, path: string, discard: Discard): void {
    const key = keyOf(workspacePath, path);
    this.keepOnly((entry) => entry.key !== key || entry.discard !== discard);
  }

  forgetWorkspace(workspacePath: string): void {
    this.keepOnly((entry) => entry.workspacePath !== workspacePath);
  }

  private keepOnly(kept: (entry: Recorded) => boolean): void {
    this.recorded = this.recorded.filter(kept);
    this.chars = this.recorded.reduce((total, { discard }) => total + charsOf(discard), 0);
  }
}

/** This window's discards. */
export const discardHistory = new DiscardHistory();

const keyOf = (workspacePath: string, path: string): string => `${workspacePath}\0${path}`;

const charsOf = ({ before, after }: Discard): number => before.length + after.length;
