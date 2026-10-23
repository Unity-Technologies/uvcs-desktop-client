import { describe, expect, it } from 'vitest';
import { MAX_SCORED_TEXT_BYTES, measureMoveSimilarities } from './moveSimilarities';

/** Binary content: a NUL byte in its start, as `looksBinary` tells it. */
const binary = (size: number) => Buffer.alloc(size, 0);

/** Reads from contents by path, counting what each side read whole. */
function reads(deletedFiles: Record<string, Buffer | string>, addedFiles: Record<string, Buffer | string>, sizes: Record<string, number> = {}) {
  const read = { deleted: [] as string[], added: [] as string[] };
  const bytes = (content: Buffer | string) => (typeof content === 'string' ? Buffer.from(content) : content);
  return {
    read,
    reads: {
      readDeleted: async (path: string) => {
        read.deleted.push(path);
        return path in deletedFiles ? bytes(deletedFiles[path]!) : null;
      },
      glanceAtAdded: async (path: string) => {
        if (!(path in addedFiles)) return null;
        const content = bytes(addedFiles[path]!);
        return { size: sizes[path] ?? content.length, isBinary: content.includes(0) };
      },
      readAdded: async (path: string) => {
        read.added.push(path);
        return path in addedFiles ? bytes(addedFiles[path]!) : null;
      },
      yieldNow: async () => {},
    },
  };
}

describe('measuring the pairs of a Search matches', () => {
  it('measures text files by their lines and binary files by their sizes, in order', async () => {
    const { reads: io } = reads({ 'a.cs': 'x\ny\n', 'a.png': binary(100) }, { 'b.cs': 'x\ny\n', 'c.cs': 'x\nz\n', 'b.png': binary(80) });

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
    const { reads: io } = reads({ 'a.cs': 'x\n', 'a.png': binary(10) }, { 'b.png': binary(10), 'b.PNG': binary(10), 'b.psd': binary(10), 'b.cs': 'x\n' });

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

  it('reads each deleted file once, however many pairs it is in, and no new binary file whole', async () => {
    const { read, reads: io } = reads({ 'a.cs': 'x\n', 'a.png': binary(10) }, { 'b.cs': 'x\n', 'c.cs': 'y\n', 'b.png': binary(10) });

    await measureMoveSimilarities(
      [
        { deleted: 'a.cs', added: 'b.cs' },
        { deleted: 'a.cs', added: 'c.cs' },
        { deleted: 'a.png', added: 'b.png' },
      ],
      io,
    );

    expect([...read.deleted].sort()).toEqual(['a.cs', 'a.png']);
    expect([...read.added].sort()).toEqual(['b.cs', 'c.cs']);
  });

  it("doesn't measure a text file too large to diff, unread, nor one that couldn't be read", async () => {
    const { read, reads: io } = reads({ 'a.cs': 'x\n', 'big.cs': 'x\n'.repeat(10) }, { 'b.cs': 'x\n', 'huge.log': 'x\n' }, { 'huge.log': MAX_SCORED_TEXT_BYTES + 1 });

    const similarities = await measureMoveSimilarities(
      [
        { deleted: 'a.cs', added: 'huge.log' },
        { deleted: 'a.cs', added: 'gone.cs' },
        { deleted: 'gone.cs', added: 'b.cs' },
      ],
      io,
    );

    expect(similarities).toEqual(['notMeasured', 'notMeasured', 'notMeasured']);
    expect(read.added).toEqual(['b.cs']);
  });

  it("measures a file's text without its byte order mark", async () => {
    const { reads: io } = reads({ 'a.cs': '﻿x\n' }, { 'b.cs': 'x\n' });

    expect(await measureMoveSimilarities([{ deleted: 'a.cs', added: 'b.cs' }], io)).toEqual([1]);
  });
});
