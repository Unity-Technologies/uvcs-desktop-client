import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGrowthWhenDoubled } from '@shared/testing/countedReads';
import { catArgs, catBatchesOf, type CatRead } from './catBatches';
import { fitsCommandLine } from './commandLineLimit';

const read = (id: number, { repository = 'eco@local' as string | null, folder = '/tmp/s', size = -1 } = {}): CatRead => ({
  spec: `revid:${id}@${repository ?? 'eco@local'}`,
  repository,
  target: join(folder, `t${id}`),
  size,
});
const asIs = (one: CatRead) => one;
const specsOf = (batches: CatRead[][]) => batches.map((batch) => batch.map((one) => one.spec));

describe('catBatchesOf', () => {
  it("batches by repository, an xlinked repository's revisions apart: cm cat resolves each repository on its own", () => {
    const batches = catBatchesOf([read(1), read(2, { repository: 'lib@local' }), read(3)], asIs);
    expect(specsOf(batches)).toEqual([['revid:1@eco@local', 'revid:3@eco@local'], ['revid:2@lib@local']]);
  });

  it("reads alone a revision whose repository can't be told", () => {
    expect(specsOf(catBatchesOf([read(1), read(2, { repository: null }), read(3)], asIs))).toEqual([['revid:2@eco@local'], ['revid:1@eco@local', 'revid:3@eco@local']]);
  });

  it('stops a batch at the bytes given, an unknown size counting as told, a revision past them alone', () => {
    const batches = catBatchesOf([read(1, { size: 6 }), read(2), read(3, { size: 2 }), read(4, { size: 50 }), read(5, { size: 1 })], asIs, { maxBytes: 10, unknownSize: 4 });
    expect(batches.map((batch) => batch.length)).toEqual([2, 1, 1, 1]);
  });

  it('fills each command line Windows can start, and no more', () => {
    const folder = join('C:', 'Users', 'Jo Smith', 'AppData', 'Local', 'Temp', 'uvcs-revisions-x');
    const many = Array.from({ length: 2000 }, (_, i) => read(i, { folder }));
    const batches = catBatchesOf(many, asIs);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toEqual(many);
    expect(batches.every((batch) => fitsCommandLine(catArgs(batch)))).toBe(true);
    expect(batches.slice(0, -1).every((batch, index) => !fitsCommandLine(catArgs([...batch, batches[index + 1]![0]!])))).toBe(true);
  });

  it('batches in linear work: twice the revisions, about twice the reads', () => {
    const many = (count: number) => Array.from({ length: count }, (_, i) => read(i));
    expect(readGrowthWhenDoubled(100, many, (items) => catBatchesOf(items, asIs))).toBeLessThan(2.5);
  });

  it('reads alone, as --file, a revision whose file is in a folder whose path holds a ;', () => {
    const batches = catBatchesOf([read(1, { folder: '/tmp/a;b' }), read(2, { folder: '/tmp/a;b' })], asIs);
    expect(batches).toHaveLength(2);
    expect(catArgs(batches[0]!)).toEqual(['cat', 'revid:1@eco@local', `--file=${join('/tmp/a;b', 't1')}`]);
  });
});

describe('catArgs', () => {
  it('reads one revision as cm cat <spec> --file=<file>, and several as <spec>;<file> each', () => {
    expect(catArgs([read(1)])).toEqual(['cat', 'revid:1@eco@local', `--file=${join('/tmp/s', 't1')}`]);
    expect(catArgs([read(1), read(2)])).toEqual(['cat', `revid:1@eco@local;${join('/tmp/s', 't1')}`, `revid:2@eco@local;${join('/tmp/s', 't2')}`]);
  });
});
