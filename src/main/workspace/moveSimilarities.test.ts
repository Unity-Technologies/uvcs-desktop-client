import { describe, expect, it } from 'vitest';
import type { DeletedFile } from '../cm/deletedFiles';
import { MAX_SCORED_TEXT_BYTES, measureMoveSimilarities, namedFew, type SimilarityReads } from './moveSimilarities';

/** Binary content: a NUL byte in its start, as `looksBinary` tells it. */
const binary = (size: number) => Buffer.alloc(size, 0);

interface DeletedEntry {
  content: Buffer | string;
  /** `cm`'s kind of it; by default, binary content is a binary file. */
  isBinary?: boolean;
  /** `cm`'s size of it; by default, the content's. */
  size?: number;
}

/** Reads from contents by path, recording what was listed, read whole and found unreadable. */
function reads(deletedFiles: Record<string, DeletedEntry | Buffer | string>, addedFiles: Record<string, Buffer | string>, addedSizes: Record<string, number> = {}) {
  const read = { listed: [] as string[][], deleted: [] as string[], added: [] as string[], unreadable: [] as string[] };
  const bytes = (content: Buffer | string) => (typeof content === 'string' ? Buffer.from(content) : content);
  const entries = Object.entries(deletedFiles).map(([path, entry]): [string, DeletedEntry] => [path, typeof entry === 'string' || Buffer.isBuffer(entry) ? { content: entry } : entry]);
  const io: SimilarityReads = {
    listDeleted: async (paths) => {
      read.listed.push([...paths]);
      const listed = new Map<string, DeletedFile>();
      entries.forEach(([path, { content, isBinary, size }], index) => {
        if (paths.includes(path)) listed.set(path, { revision: { revisionId: index + 1, repository: 'game@local' }, isBinary: isBinary ?? bytes(content).includes(0), size: size ?? bytes(content).length });
      });
      return listed;
    },
    readDeleted: async ({ revision }) => {
      const [path, { content }] = entries[revision.revisionId - 1]!;
      read.deleted.push(path);
      return bytes(content);
    },
    glanceAtAdded: async (path) => {
      if (!(path in addedFiles)) throw new Error(`${path} isn't there`);
      const content = bytes(addedFiles[path]!);
      return { size: addedSizes[path] ?? content.length, isBinary: content.includes(0) };
    },
    readAdded: async (path) => {
      read.added.push(path);
      return bytes(addedFiles[path]!);
    },
    onUnreadable: (path) => void read.unreadable.push(path),
    yieldNow: async () => {},
  };
  return { read, io };
}

describe('measuring the pairs of a Search matches', () => {
  it('measures text files by their lines and binary files by their sizes, in order', async () => {
    const { io } = reads({ 'a.cs': 'x\ny\n', 'a.png': binary(100) }, { 'b.cs': 'x\ny\n', 'c.cs': 'x\nz\n', 'b.png': binary(80) });

    const similarities = await measureMoveSimilarities(
      [
        { deleted: 'a.cs', added: 'b.cs' },
        { deleted: 'a.cs', added: 'c.cs' },
        { deleted: 'a.png', added: 'b.png' },
      ],
      io,
    );

    expect(similarities[0]).toBe(1);
    expect(similarities[1]).toBe(0);
    expect(similarities[2]).toBeCloseTo(0.8);
  });

  it("doesn't pair what cm's move detection doesn't: text with binary, binary files of other extensions", async () => {
    const { io } = reads({ 'a.cs': 'x\n', 'a.png': binary(10) }, { 'b.png': binary(10), 'b.PNG': binary(10), 'b.psd': binary(10), 'b.cs': 'x\n' });

    expect(
      await measureMoveSimilarities(
        [
          { deleted: 'a.cs', added: 'b.png' },
          { deleted: 'a.png', added: 'b.cs' },
          { deleted: 'a.png', added: 'b.psd' },
          { deleted: 'a.png', added: 'b.PNG' },
        ],
        io,
      ),
    ).toEqual(['notPairable', 'notPairable', 'notPairable', 1]);
  });

  it("takes a deleted file's kind as cm keeps it, whatever its content: a text asset kept as binary is sized", async () => {
    const { read, io } = reads({ 'Hero.asset': { content: 'yaml: 1\n', isBinary: true, size: 1000 } }, { 'New.asset': binary(900) });

    expect(await measureMoveSimilarities([{ deleted: 'Hero.asset', added: 'New.asset' }], io)).toEqual([0.9]);
    expect(read.deleted).toEqual([]);
  });

  it('lists every deleted file once, reads only the text ones, and no new binary file whole', async () => {
    const { read, io } = reads({ 'a.cs': 'x\n', 'a.png': binary(10) }, { 'b.cs': 'x\n', 'c.cs': 'y\n', 'b.png': binary(10) });

    await measureMoveSimilarities(
      [
        { deleted: 'a.cs', added: 'b.cs' },
        { deleted: 'a.cs', added: 'c.cs' },
        { deleted: 'a.png', added: 'b.png' },
      ],
      io,
    );

    expect(read.listed).toEqual([['a.cs', 'a.png']]);
    expect(read.deleted).toEqual(['a.cs']);
    expect([...read.added].sort()).toEqual(['b.cs', 'c.cs']);
  });

  it("doesn't read a text file too large to diff, on either side", async () => {
    const { read, io } = reads({ 'a.cs': 'x\n', 'big.cs': { content: 'x\n', size: MAX_SCORED_TEXT_BYTES + 1 } }, { 'b.cs': 'x\n', 'huge.log': 'x\n' }, { 'huge.log': MAX_SCORED_TEXT_BYTES + 1 });

    const similarities = await measureMoveSimilarities(
      [
        { deleted: 'a.cs', added: 'huge.log' },
        { deleted: 'big.cs', added: 'b.cs' },
      ],
      io,
    );

    expect(similarities).toEqual(['notMeasured', 'notMeasured']);
    expect(read.deleted).toEqual(['a.cs']);
    expect(read.added).toEqual(['b.cs']);
  });

  it("measures nothing it couldn't read, and tells which", async () => {
    const { read, io } = reads({ 'a.cs': 'x\n' }, { 'b.cs': 'x\n' });

    const similarities = await measureMoveSimilarities(
      [
        { deleted: 'a.cs', added: 'gone.cs' },
        { deleted: 'unlisted.cs', added: 'b.cs' },
      ],
      io,
    );

    expect(similarities).toEqual(['notMeasured', 'notMeasured']);
    expect(read.unreadable).toEqual(['gone.cs']);
  });

  it('tells when cm lists none of the deleted files', async () => {
    const { read, io } = reads({}, { 'b.cs': 'x\n' });
    io.listDeleted = () => Promise.reject(new Error('cm failed'));

    expect(await measureMoveSimilarities([{ deleted: 'a.cs', added: 'b.cs' }], io)).toEqual(['notMeasured']);
    expect(read.unreadable).toEqual(['a.cs']);
  });

  it("measures a file's text without its byte order mark", async () => {
    const { io } = reads({ 'a.cs': '\uFEFFx\n' }, { 'b.cs': 'x\n' });

    expect(await measureMoveSimilarities([{ deleted: 'a.cs', added: 'b.cs' }], io)).toEqual([1]);
  });
});

describe('the paths a warning names', () => {
  it('names a few and counts the rest', () => {
    expect(namedFew(['a.cs'])).toBe('a.cs');
    expect(namedFew(['a.cs', 'b.cs', 'c.cs'])).toBe('a.cs, b.cs, c.cs');
    expect(namedFew(['a.cs', 'b.cs', 'c.cs', 'd.cs', 'e.cs'])).toBe('a.cs, b.cs, c.cs and 2 more');
  });
});
