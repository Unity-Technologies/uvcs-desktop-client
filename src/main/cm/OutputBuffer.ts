import { leftOutMarker } from './outputLimit';

/**
 * The output of a command as it arrives, in chunks. Its end is at hand for each chunk without joining the whole:
 * appending to one string and looking at its end flattens it every time, which made a 60 MB output take seconds.
 *
 * With `keepAtMost`, it keeps the first and the last half of that many characters and leaves the middle out as it
 * arrives (`TextLimit` `keepEnds`: an operation's line per item), so it never holds more, however much is printed.
 */
export class OutputBuffer {
  private head: string[] = [];
  private headSize = 0;
  /** The chunks after the head, the oldest dropped once the newer ones hold the tail's half on their own. */
  private tailChunks: string[] = [];
  private tailSize = 0;
  private size = 0;
  private end = '';

  /** `tailLength`: how much of the end `tail` keeps. */
  constructor(
    private readonly tailLength: number,
    private readonly keepAtMost = Number.POSITIVE_INFINITY,
  ) {}

  get length(): number {
    return this.size;
  }

  /** The last `tailLength` characters (all of them when there are fewer). */
  get tail(): string {
    return this.end;
  }

  append(text: string): void {
    this.size += text.length;
    // `slice(-0)` is the whole text: with no tail kept, none is.
    if (this.tailLength > 0) this.end = text.length >= this.tailLength ? text.slice(-this.tailLength) : (this.end + text).slice(-this.tailLength);
    const headRoom = this.keepAtMost / 2 - this.headSize;
    if (headRoom >= text.length) return void this.keepInHead(text);
    if (headRoom > 0) this.keepInHead(text.slice(0, headRoom));
    this.keepInTail(headRoom > 0 ? text.slice(headRoom) : text);
  }

  /** Everything before `end`, with the middle left out marked (`leftOutMarker`) when it had to be. */
  textBefore(end: number): string {
    const tailStart = this.size - this.tailSize;
    const leftOut = tailStart - this.headSize;
    if (leftOut === 0) return [...this.head, ...this.tailChunks].join('').slice(0, end);
    if (end <= this.headSize) return this.head.join('').slice(0, end);
    return this.head.join('') + leftOutMarker(leftOut) + this.tailChunks.join('').slice(0, Math.max(0, end - tailStart));
  }

  clear(): void {
    this.head = [];
    this.headSize = 0;
    this.tailChunks = [];
    this.tailSize = 0;
    this.size = 0;
    this.end = '';
  }

  private keepInHead(text: string): void {
    this.head.push(text);
    this.headSize += text.length;
  }

  private keepInTail(text: string): void {
    const half = this.keepAtMost / 2;
    // A chunk longer than the half keeps its end alone.
    const kept = text.length > half ? text.slice(-half) : text;
    if (kept !== text) {
      this.tailChunks = [];
      this.tailSize = 0;
    }
    this.tailChunks.push(kept);
    this.tailSize += kept.length;
    while (this.tailChunks.length > 1 && this.tailSize - this.tailChunks[0]!.length >= half) this.tailSize -= this.tailChunks.shift()!.length;
  }
}
