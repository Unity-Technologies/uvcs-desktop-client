import { describe, expect, it } from 'vitest';
import { mergedIntoArgs, parseMergedInto } from './mergedInto';

describe('mergedIntoArgs', () => {
  it('asks for one merge link from the changeset into the branch', () => {
    expect(mergedIntoArgs(42, "/main/o'neil")).toEqual([
      'find',
      'merge',
      "where srcchangeset = 42 and dstbranch like '/main/o%neil' limit 1",
      '--format={dstchangeset}\u001e',
      '--nototal',
    ]);
  });
});

describe('parseMergedInto', () => {
  it('reads the destination changeset', () => {
    expect(parseMergedInto('57\u001e\n')).toBe(57);
  });

  it('is null when there is no such merge', () => {
    expect(parseMergedInto('')).toBeNull();
  });
});
