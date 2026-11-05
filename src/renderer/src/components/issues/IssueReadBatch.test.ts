import { describe, expect, it } from 'vitest';
import type { IssueRead } from '@shared/domain/issueTrackers';
import { IssueReadBatch } from './IssueReadBatch';

function batchWithManualFlush() {
  const asked: { connectionId: string; keys: string[] }[] = [];
  let flush: (() => void) | null = null;
  const batch = new IssueReadBatch(
    async (connectionId, keys) => {
      asked.push({ connectionId, keys });
      return keys.map((key): IssueRead => (key.endsWith('99') ? { key, kind: 'missing' } : { key, kind: 'noAccess' }));
    },
    (scheduled) => {
      flush = scheduled;
    },
  );
  return { batch, asked, flush: () => flush?.() };
}

describe('IssueReadBatch', () => {
  it('reads every key asked in the same task in one request per connection, each key once', async () => {
    const { batch, asked, flush } = batchWithManualFlush();
    const reads = [batch.read('c1', 'VCS-1'), batch.read('c1', 'VCS-99'), batch.read('c1', 'VCS-1'), batch.read('c2', 'acme/game#3')];
    flush();
    expect(await Promise.all(reads)).toEqual([
      { key: 'VCS-1', kind: 'noAccess' },
      { key: 'VCS-99', kind: 'missing' },
      { key: 'VCS-1', kind: 'noAccess' },
      { key: 'acme/game#3', kind: 'noAccess' },
    ]);
    expect(asked).toEqual([
      { connectionId: 'c1', keys: ['VCS-1', 'VCS-99'] },
      { connectionId: 'c2', keys: ['acme/game#3'] },
    ]);
  });

  it('starts a new batch for what is asked after one went', async () => {
    const { batch, asked, flush } = batchWithManualFlush();
    const first = batch.read('c1', 'VCS-1');
    flush();
    await first;
    const second = batch.read('c1', 'VCS-2');
    flush();
    await second;
    expect(asked.map(({ keys }) => keys)).toEqual([['VCS-1'], ['VCS-2']]);
  });

  it('fails every key of a batch whose request failed', async () => {
    let flush: () => void = () => undefined;
    const batch = new IssueReadBatch(
      () => Promise.reject(new Error('main is gone')),
      (scheduled) => {
        flush = scheduled;
      },
    );
    const read = batch.read('c1', 'VCS-1');
    flush();
    await expect(read).rejects.toThrow('main is gone');
  });
});
