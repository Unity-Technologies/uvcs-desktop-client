import { describe, expect, it } from 'vitest';
import { mergeCommandsOffered } from './mergeCommandsOffered';

describe('mergeCommandsOffered', () => {
  it('offers every merge, and applying a shelve, where merges are offered', () => {
    expect(mergeCommandsOffered(true)).toEqual(['merge.fromBranch', 'merge.toBranch', 'merge.cherryPick', 'merge.subtractive', 'merge.applyShelve']);
  });

  it('offers only applying a shelve in a partial workspace', () => {
    expect(mergeCommandsOffered(false)).toEqual(['merge.applyShelve']);
  });
});
