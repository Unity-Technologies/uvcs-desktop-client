import { describe, expect, it } from 'vitest';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { findMergedInto, mergedIntoArgs } from './mergedInto';

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

describe('findMergedInto', () => {
  it('reads the destination changeset with one quick find, read as records', async () => {
    const { cm, commands } = fakeCmClient({ 'find merge': formatOutput(['57']) });

    await expect(findMergedInto(cm, '/wk', 42, '/main')).resolves.toBe(57);

    expect(commands.map(({ via, args, options, readsRecords }) => [via, args, options.cwd, readsRecords])).toEqual([['query', mergedIntoArgs(42, '/main'), '/wk', true]]);
  });

  it('is null when there is no such merge', async () => {
    const { cm } = fakeCmClient({ 'find merge': '' });
    await expect(findMergedInto(cm, '/wk', 42, '/main')).resolves.toBeNull();
  });
});
