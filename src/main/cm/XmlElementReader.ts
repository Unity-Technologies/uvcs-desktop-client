import { child, parseXml, type XmlNode } from './parseXml';
import type { StreamReader } from './outputReading';

/** What a caller builds of each element read (a revision); undefined leaves it out. */
export type ReadElement<T> = (element: XmlNode) => T | undefined;

/**
 * Reads the elements named `name` of an XML list as they arrive, in byte chunks, into what `readElement` builds of
 * each (`parseXml`, its `arrays` always arrays): for a command whose list only `--xml` prints whole (`cm history`, whose
 * `--format` has no revision type). Only the element still arriving is kept between chunks: the output is never held
 * whole, and what lies between the elements (the root, the list's own tags) is dropped.
 *
 * The elements are found by their tags, in bytes: `cm` escapes `<` in values, so `<name>` and `</name>` only ever open
 * and close one, and an element of that name never holds another.
 */
export class XmlElementReader<T> implements StreamReader {
  private readonly rows: T[] = [];
  private readonly openTag: Buffer;
  private readonly closeTag: Buffer;
  /** The bytes after the last element read: the one still arriving, and whatever came before it. */
  private carried = Buffer.alloc(0);

  constructor(
    private readonly name: string,
    private readonly readElement: ReadElement<T>,
    private readonly arrays: readonly string[] = [],
  ) {
    this.openTag = Buffer.from(`<${name}>`, 'utf8');
    this.closeTag = Buffer.from(`</${name}>`, 'utf8');
  }

  /** How many elements were read so far: what a caller (a test) checks to tell they are read as they arrive. */
  get count(): number {
    return this.rows.length;
  }

  read(chunk: Buffer): void {
    // A close tag split between the chunks is found again: the search starts that far back in the bytes carried.
    const searchFrom = Math.max(0, this.carried.length - this.closeTag.length + 1);
    const bytes = this.carried.length === 0 ? chunk : Buffer.concat([this.carried, chunk]);
    let consumed = 0;
    for (let close = bytes.indexOf(this.closeTag, searchFrom); close >= 0; close = bytes.indexOf(this.closeTag, consumed)) {
      const end = close + this.closeTag.length;
      const open = bytes.lastIndexOf(this.openTag, close);
      if (open >= consumed) this.readElementIn(bytes.toString('utf8', open, end));
      consumed = end;
    }
    // A copy, not a slice: what is carried keeps no chunk alive.
    this.carried = Buffer.from(bytes.subarray(consumed));
  }

  /** The text after the last element (the list's closing tags, or the error of a command that printed none), which it then forgets. */
  takeRest(): string {
    const rest = this.carried.toString('utf8').replaceAll('\r\n', '\n');
    this.carried = Buffer.alloc(0);
    return rest;
  }

  /** The rows read. */
  finish(): T[] {
    return this.rows;
  }

  private readElementIn(xml: string): void {
    const element = child(parseXml(xml, [...this.arrays]), this.name);
    const row = element && this.readElement(element);
    if (row !== undefined) this.rows.push(row);
  }
}
