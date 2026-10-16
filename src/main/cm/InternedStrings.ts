/**
 * One string for each distinct text many rows repeat: the owners of a repository's changesets, the branch each one is
 * on. Each field a record is read from is a string of its own (`RecordReader`), so 280,000 changesets by a few hundred
 * people would otherwise hold 280,000 copies of their names. Shared by the reads of one answer, then let go: it keeps
 * every text it saw.
 */
export class InternedStrings {
  private readonly strings = new Map<string, string>();

  of(text: string): string {
    const known = this.strings.get(text);
    if (known !== undefined) return known;
    this.strings.set(text, text);
    return text;
  }
}
