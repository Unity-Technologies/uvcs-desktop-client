import { describe, expect, it } from 'vitest';
import { CmError } from '../CmError';
import { cmFails, fakeCmClient } from './fakeCmClient';

describe('fakeCmClient', () => {
  it('fails any command it has no answer for, so a new command never goes unnoticed', async () => {
    const { cm } = fakeCmClient({ 'find branch': '' });

    await expect(cm.query(['find', 'changeset'])).rejects.toThrow('Unexpected cm command (query): cm find changeset');
    await expect(cm.query(['find', 'branchy'])).rejects.toThrow('Unexpected cm command');
  });

  it("fails a command naming a Unity organization's server by its id, which the app always names first", async () => {
    const { cm } = fakeCmClient({ cat: '', 'find revision': '', 'lock list': '', 'profile delete': '', 'find changeset': '' });

    for (const args of [
      ['cat', 'revid:45@game@2398571046213@cloud'],
      ['find', 'revision', "where itemid = 7 on repository 'game@2398571046213@cloud'"],
      ['lock', 'list', '--repository=game@2398571046213@cloud'],
    ]) {
      await expect(cm.query(args)).rejects.toThrow("A Unity organization's server by its id reached cm");
    }
    // A profile's name is the id form itself, as `cm profile list` prints it; and a changeset of a repository named so.
    await expect(cm.query(['profile', 'delete', '--name=2398571046213@cloud'])).resolves.toBe('');
    await expect(cm.query(['find', 'changeset', 'cs:5@cloud', 'game@AcmeStudio@unity'])).resolves.toBe('');
  });

  it('answers with the longest key the command starts with, and records how each command was run', async () => {
    const { cm, commands, linesVia } = fakeCmClient({ find: 'any', 'find branch': 'branches' });

    expect(await cm.query(['find', 'branch', '--xml'], { cwd: 'wk' })).toBe('branches');
    expect(await cm.execute(['find', 'changeset'])).toBe('any');
    expect(commands.map(({ via, line, options }) => ({ via, line, options }))).toEqual([
      { via: 'query', line: 'find branch --xml', options: { cwd: 'wk' } },
      { via: 'execute', line: 'find changeset', options: {} },
    ]);
    expect(linesVia('execute')).toEqual(['find changeset']);
  });

  it('tells whether a command starting with whole words was asked', async () => {
    const { cm, ran } = fakeCmClient({ find: '' });

    await cm.query(['find', 'branch', '--xml']);

    expect([ran('find'), ran('find branch'), ran('find bran'), ran('find changeset')]).toEqual([true, true, false, false]);
  });

  it('fails as CmClient does: a CmError with the line that explains it and the command', async () => {
    const { cm } = fakeCmClient({ switch: cmFails('Searching...\nError: The branch does not exist.\n') });

    const error = await cm.query(['switch', 'br:/x']).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CmError);
    expect(error).toMatchObject({ message: 'The branch does not exist.', command: { commandLine: 'cm switch br:/x', exitCode: 1 } });
  });
});
