import { describe, expect, it } from 'vitest';
import type { ItemType, MatchItem } from '@shared/domain/pendingChanges';
import { MAX_SCORED_TEXT_BYTES, measureMoveSimilarities } from './moveSimilarities';

const item = (path: string, itemType: ItemType = 'file', size = 10): MatchItem => ({ path, itemType, size });

/** Reads from texts by path, counting what each side read. */
function reads(deletedTexts: Record<string, string>, addedTexts: Record<string, string>) {
  const read = { deleted: [] as string[], added: [] as string[] };
  const from = (texts: Record<string, string>, log: string[]) => async (path: string) => {
    log.push(path);
    return path in texts ? Buffer.from(texts[path]!) : null;
  };
  return { read, reads: { readDeleted: from(deletedTexts, read.deleted), readAdded: from(addedTexts, read.added), yieldNow: async () => {} } };
}

describe('measuring the pairs of a Search matches', () => {
  it('scores text pairs by their lines and binary pairs by their sizes, in order', async () => {
    const { reads: io } = reads({ 'a.cs': 'x\ny\n' }, { 'b.cs': 'x\ny\n', 'c.cs': 'x\nz\n' });

    const similarities = await measureMoveSimilarities(
      [
        { deleted: item('a.cs'), added: item('b.cs') },
        { deleted: item('a.cs'), added: item('c.cs') },
        { deleted: item('a.png', 'binaryFile', 100), added: item('b.png', 'binaryFile', 80) },
      ],
      io,
    );

    expect(similarities[0]).toBe(1);
    expect(similarities[1]).toBe(0);
    expect(similarities[2]).toBeCloseTo(0.8);
  });

  it('reads each file once, however many pairs it is in, and no binary file', async () => {
    const { read, reads: io } = reads({ 'a.cs': 'x\n' }, { 'b.cs': 'x\n', 'c.cs': 'y\n' });

    await measureMoveSimilarities(
      [
        { deleted: item('a.cs'), added: item('b.cs') },
        { deleted: item('a.cs'), added: item('c.cs') },
        { deleted: item('a.png', 'binaryFile'), added: item('b.png', 'binaryFile') },
      ],
      io,
    );

    expect(read.deleted).toEqual(['a.cs']);
    expect([...read.added].sort()).toEqual(['b.cs', 'c.cs']);
  });

  it("leaves unscored what cm's detection doesn't pair: folders, and a text file with a binary one", async () => {
    const { read, reads: io } = reads({}, {});

    const similarities = await measureMoveSimilarities(
      [
        { deleted: item('src', 'directory'), added: item('lib', 'directory') },
        { deleted: item('a.cs'), added: item('a.png', 'binaryFile') },
        { deleted: item('a.png', 'binaryFile'), added: item('a.cs') },
      ],
      io,
    );

    expect(similarities).toEqual([null, null, null]);
    expect(read).toEqual({ deleted: [], added: [] });
  });

  it("leaves unscored a file too large to diff, unread, and one that couldn't be read", async () => {
    const { read, reads: io } = reads({ 'a.cs': 'x\n' }, {});

    const similarities = await measureMoveSimilarities(
      [
        { deleted: item('a.cs', 'file', MAX_SCORED_TEXT_BYTES + 1), added: item('b.cs') },
        { deleted: item('a.cs'), added: item('gone.cs') },
      ],
      io,
    );

    expect(similarities).toEqual([null, null]);
    expect(read.added).toEqual(['gone.cs']);
  });

  it("scores a file's text without its byte order mark", async () => {
    const { reads: io } = reads({ 'a.cs': '﻿x\n' }, { 'b.cs': 'x\n' });

    expect(await measureMoveSimilarities([{ deleted: item('a.cs'), added: item('b.cs') }], io)).toEqual([1]);
  });
});
