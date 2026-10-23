import { describe, expect, it } from 'vitest';
import { CmError } from '../CmError';
import { formatOutput } from './cmOutput';
import { cmFails, fakeCmClient } from './fakeCmClient';

describe('fakeCmClient', () => {
  it('fails any command it has no answer for, so a new command never goes unnoticed', async () => {
    const { cm } = fakeCmClient({ 'find branch': '' });

    await expect(cm.queryRecords(['find', 'changeset'], (fields) => fields)).rejects.toThrow('Unexpected cm command (query): cm find changeset');
    await expect(cm.queryRecords(['find', 'branchy'], (fields) => fields)).rejects.toThrow('Unexpected cm command');
  });

  it('refuses a list read as one string, as CmClient does', async () => {
    const { cm, commands } = fakeCmClient({ 'find branch': '' });

    await expect(cm.query(['find', 'branch'])).rejects.toThrow('cm find branch prints a list');
    expect(commands).toEqual([]);
  });

  it('hands each line of the output to the lines listener, as CmClient does', async () => {
    const lines: string[] = [];
    const { cm } = fakeCmClient({ update: 'Downloading\r\nUpdated 3 items\n' });

    await cm.execute(['update'], { onOutputLine: (line) => lines.push(line) });

    expect(lines).toEqual(['Downloading', 'Updated 3 items']);
  });

  it("fails a command naming a Unity organization's server by its id, which the app always names first", async () => {
    const { cm } = fakeCmClient({ cat: '', 'find revision': '', 'lock list': '', 'profile delete': '', 'find changeset': '' });

    for (const args of [
      ['cat', 'revid:45@game@2398571046213@cloud'],
      ['find', 'revision', "where itemid = 7 on repository 'game@2398571046213@cloud'"],
      ['lock', 'list', '--repository=game@2398571046213@cloud'],
    ]) {
      await expect(cm.queryRecords(args, (fields) => fields)).rejects.toThrow("A Unity organization's server by its id reached cm");
    }
    // A profile's name is the id form itself, as `cm profile list` prints it; and a changeset of a repository named so.
    await expect(cm.query(['profile', 'delete', '--name=2398571046213@cloud'])).resolves.toBe('');
    await expect(cm.queryRecords(['find', 'changeset', 'cs:5@cloud', 'game@AcmeStudio@unity'], (fields) => fields)).resolves.toEqual([]);
  });

  it('answers with the longest key the command starts with, and records how each command was run', async () => {
    const { cm, commands, linesVia } = fakeCmClient({ branch: 'any', 'branch create': 'created' });

    expect(await cm.query(['branch', 'create', 'br:/main/task'], { cwd: 'wk' })).toBe('created');
    expect(await cm.execute(['branch', 'delete', 'br:/main/task'])).toBe('any');
    expect(commands.map(({ via, line, options }) => ({ via, line, options }))).toEqual([
      { via: 'query', line: 'branch create br:/main/task', options: { cwd: 'wk' } },
      { via: 'execute', line: 'branch delete br:/main/task', options: {} },
    ]);
    expect(linesVia('execute')).toEqual(['branch delete br:/main/task']);
  });

  it('answers a command read as records from the same --format output, recording how it was run', async () => {
    const { cm, commands, linesVia } = fakeCmClient({ 'find branch': formatOutput(['3', '/main'], ['37', '/main/task']), 'find merge': formatOutput(['merge', '2', '5']) });

    const branches = await cm.queryRecords(['find', 'branch'], ([id = '', name = '']) => ({ id: Number(id), name }));
    const merges = await cm.executeRecords(['find', 'merge'], ([type]) => type);

    expect(branches).toEqual([
      { id: 3, name: '/main' },
      { id: 37, name: '/main/task' },
    ]);
    expect(merges).toEqual(['merge']);
    expect([linesVia('query'), linesVia('execute')]).toEqual([['find branch'], ['find merge']]);
    expect(commands.map((command) => command.readsRecords)).toEqual([true, true]);
  });

  it('reads text after the last record as no record, as CmClient does', async () => {
    const { cm } = fakeCmClient({ 'find branch': `${formatOutput(['3', '/main'])}Warning: the server is slow.\n` });

    await expect(cm.queryRecords(['find', 'branch'], (fields) => fields)).resolves.toEqual([['3', '/main']]);
  });

  it('fails a command read as records as CmClient does', async () => {
    const { cm } = fakeCmClient({ 'find branch': cmFails('Error: The repository does not exist.\n') });

    await expect(cm.queryRecords(['find', 'branch'], (fields) => fields)).rejects.toMatchObject({ message: 'The repository does not exist.' });
  });

  it('tells whether a command starting with whole words was asked', async () => {
    const { cm, ran } = fakeCmClient({ find: '' });

    await cm.queryRecords(['find', 'branch', 'where name = 1'], (fields) => fields);

    expect([ran('find'), ran('find branch'), ran('find bran'), ran('find changeset')]).toEqual([true, true, false, false]);
  });

  it('fails as CmClient does: a CmError with the line that explains it and the command', async () => {
    const { cm } = fakeCmClient({ switch: cmFails('Searching...\nError: The branch does not exist.\n') });

    const error = await cm.query(['switch', 'br:/x']).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CmError);
    expect(error).toMatchObject({ message: 'The branch does not exist.', command: { commandLine: 'cm switch br:/x', exitCode: 1 } });
  });
});
