/**
 * The output of a command as it arrives, in chunks. Its end is at hand for each chunk without joining the whole:
 * appending to one string and looking at its end flattens it every time, which made a 60 MB output take seconds.
 */
export class OutputBuffer {
  private chunks: string[] = [];
  private size = 0;
  private end = '';

  /** `tailLength`: how much of the end `tail` keeps. */
  constructor(private readonly tailLength: number) {}

  get length(): number {
    return this.size;
  }

  /** The last `tailLength` characters (all of them when there are fewer). */
  get tail(): string {
    return this.end;
  }

  append(text: string): void {
    this.chunks.push(text);
    this.size += text.length;
    this.end = text.length >= this.tailLength ? text.slice(-this.tailLength) : (this.end + text).slice(-this.tailLength);
  }

  /** Everything before `end`. */
  textBefore(end: number): string {
    return this.chunks.join('').slice(0, end);
  }

  clear(): void {
    this.chunks = [];
    this.size = 0;
    this.end = '';
  }
}
