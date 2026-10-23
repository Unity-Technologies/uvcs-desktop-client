import { fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { conflictVersionQuery, PURGED_VERSION_MESSAGE } from './conflictVersionQuery';

// The real client listens to the window's focus.
vi.mock('../../../app/queryClient', () => ({ IMMUTABLE_QUERY: { immutable: true } }));

describe('conflictVersionQuery', () => {
  it("leaves a shelve's revision out of refreshes: the shelve may be deleted once the merge completes", () => {
    expect(conflictVersionQuery('/ws', { kind: 'spec', spec: 'itemid:23#sh:3', fileName: 'a.txt' }).meta).toEqual({ immutable: true });
  });

  it('keeps refreshing the workspace version', () => {
    expect(conflictVersionQuery('/ws', { kind: 'workspaceFile', path: 'a.txt' }).meta).toBeUndefined();
  });

  it('fails a version whose content was purged, never taking it as an empty text to merge', async () => {
    fakeApi.answer('content.read', () => ({ isBinary: false, size: 0, purged: true }));
    await expect(conflictVersionQuery('/ws', { kind: 'spec', spec: 'itemid:23#cs:4', fileName: 'a.txt' }).queryFn()).rejects.toThrow(PURGED_VERSION_MESSAGE);
  });

  it('reads any other version as it is', async () => {
    const text = { text: 'a\n', isBinary: false, size: 2 };
    fakeApi.answer('content.read', () => text);
    expect(await conflictVersionQuery('/ws', { kind: 'spec', spec: 'itemid:23#cs:4', fileName: 'a.txt' }).queryFn()).toEqual(text);
  });
});
