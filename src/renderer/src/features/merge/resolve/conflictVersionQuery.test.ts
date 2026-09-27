import { describe, expect, it, vi } from 'vitest';
import { conflictVersionQuery } from './conflictVersionQuery';

// The real client listens to the window's focus.
vi.mock('../../../app/queryClient', () => ({ IMMUTABLE_QUERY: { immutable: true } }));

describe('conflictVersionQuery', () => {
  it("leaves a shelve's revision out of refreshes: the shelve may be deleted once the merge completes", () => {
    expect(conflictVersionQuery('/ws', { kind: 'spec', spec: 'itemid:23#sh:3', fileName: 'a.txt' }).meta).toEqual({ immutable: true });
  });

  it('keeps refreshing the workspace version', () => {
    expect(conflictVersionQuery('/ws', { kind: 'workspaceFile', path: 'a.txt' }).meta).toBeUndefined();
  });
});
