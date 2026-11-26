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

  it.each([
    'No se ha podido encontrar el repositorio: nothing-here.',
    '指定されたリポジトリが見つかりませんでした: nothing-here。',
    '지정된 리포지토리를 찾을 수 없습니다: nothing-here.',
    '无法找到指定的存储库：nothing-here。',
    '找不到指定的儲存庫: nothing-here。',
  ])('answers none when cm says so in another language: %s', async (output) => {
    const { cm } = fakeCmClient({ ls: cmFails(output) });

    expect(await repositoryIdOf(cm, 'nothing-here@local', 'local')).toBeUndefined();
  });

  it('rejects on any other failure, so a server out of reach is never taken for no repository', async () => {
    const { cm } = fakeCmClient({ ls: cmFails('Unable to connect to acme@cloud. The operation has timed out.') });

    await expect(repositoryIdOf(cm, 'game@acme@cloud', 'acme@cloud')).rejects.toThrow('Unable to connect');
  });
});
