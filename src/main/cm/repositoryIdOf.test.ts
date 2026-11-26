import { describe, expect, it } from 'vitest';
import { repositoryIdOf } from './repositoryIdOf';
import { formatOutput } from './testing/cmOutput';
import { cmFails, fakeCmClient } from './testing/fakeCmClient';

describe('repositoryIdOf', () => {
  it("reads the repository's id from the root of its first changeset, one record, in a quick read outside any workspace", async () => {
    const { cm, commands } = fakeCmClient({ ls: formatOutput(['2037']) });

    expect(await repositoryIdOf(cm, 'rename-check@local', 'local')).toBe('2037');
    expect(commands).toMatchObject([
      { via: 'query', readsRecords: true, args: ['ls', '/', '--tree=cs:0@rename-check@local', '--format={repid}\u001e'], options: { server: 'local', outsideWorkspaces: true } },
    ]);
  });

  it('takes the first record when cm prints more', async () => {
    const { cm } = fakeCmClient({ ls: formatOutput(['2037'], ['2037'], ['2037']) });

    expect(await repositoryIdOf(cm, 'game@acme@cloud', 'acme@cloud')).toBe('2037');
  });

  it('answers none for a name no repository goes by', async () => {
    const { cm } = fakeCmClient({ ls: cmFails("The specified repository couldn't be found: nothing-here.") });

    expect(await repositoryIdOf(cm, 'nothing-here@local', 'local')).toBeUndefined();
  });
});
