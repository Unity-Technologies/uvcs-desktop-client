import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { FOUND_ATTRIBUTE_TYPES, FOUND_ATTRIBUTE_VALUES } from '../cm/attributeRecords';
import { formatOutput, foundLine, recordsOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createAttributesService } from './attributesService';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const IN_WORKSPACE = workspacePlace(WORKSPACE);

function attributes(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createAttributesService(serviceContext(fake.cm)) };
}

describe('attribute types', () => {
  it('lists attribute types with one cm find', async () => {
    const { service, commands } = attributes({
      'find attributetype': recordsOutput(FOUND_ATTRIBUTE_TYPES, { id: 9, name: 'status', comment: 'Task status', owner: 'ana', date: '2026-09-25', repname: 'game', repserver: 'local' }),
    });

    const types = await service.listTypes(IN_WORKSPACE);

    expect(commands).toMatchObject([{ via: 'query', line: foundLine(FOUND_ATTRIBUTE_TYPES, ''), options: { cwd: WORKSPACE } }]);
    expect(types).toEqual([{ id: 9, name: 'status', comment: 'Task status', owner: 'ana', date: '2026-09-25', repository: 'game@local' }]);
  });

  it('creates a type, with a second command only when it has a comment', async () => {
    const { service, lines } = attributes({ attribute: '' });

    await service.createType(IN_WORKSPACE, 'status', '');
    await service.createType(IN_WORKSPACE, 'reviewer', 'Who reviewed it');

    expect(lines()).toEqual(['attribute create status', 'attribute create reviewer', 'attribute edit att:reviewer Who reviewed it']);
  });

  it('renames a type, and deletes several with one command', async () => {
    const { service, lines } = attributes({ attribute: '' });

    await service.renameType(IN_WORKSPACE, 'status', 'state');
    await service.deleteType(IN_WORKSPACE, ['status', 'reviewer']);

    expect(lines()).toEqual(['attribute rename att:status state', 'attribute delete att:status att:reviewer']);
  });
});

describe('attribute values', () => {
  it("reads an object's values with one cm find", async () => {
    const { service, lines } = attributes({ 'find attribute': recordsOutput(FOUND_ATTRIBUTE_VALUES, { name: 'status', value: 'done' }) });

    expect(await service.valuesOf(IN_WORKSPACE, 'br:/main/dani')).toEqual([{ name: 'status', value: 'done' }]);
    expect(lines()).toEqual([foundLine(FOUND_ATTRIBUTE_VALUES, "where srcobj = 'br:/main/dani'")]);
  });

  it('samples the values a type takes with one bounded query', async () => {
    const { service, commands } = attributes({ 'find attribute': formatOutput(['done'], ['in progress']) });

    expect(await service.usedValues(IN_WORKSPACE, 'status')).toEqual(['done', 'in progress']);
    expect(commands[0]?.args.slice(0, 3)).toEqual(['find', 'attribute', "where type = 'status' limit 500"]);
  });

  it('samples the values trimmed, as the values of an object are read', async () => {
    const { service } = attributes({ 'find attribute': formatOutput(['done\n'], [' in progress ']) });

    expect(await service.usedValues(IN_WORKSPACE, 'status')).toEqual(['done', 'in progress']);
  });

  it('sets a value through a file, as values may span several lines, and deletes the file afterwards', async () => {
    const { seen, answer } = readingFileOption('--valuecontents=');
    const { service, commands } = attributes({ 'attribute set': answer });

    await service.setValue(IN_WORKSPACE, 'br:/main/task1', 'notes', '# Notes\n- one');

    expect(commands).toMatchObject([{ via: 'query', args: ['attribute', 'set', 'att:notes', 'br:/main/task1', `--valuecontents=${seen.file}`] }]);
    expect(seen.content).toBe('# Notes\n- one');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('deletes the value file when setting the value fails', async () => {
    const { seen, answer } = readingFileOption('--valuecontents=', cmFails('Error: The attribute notes does not exist.'));
    const { service } = attributes({ 'attribute set': answer });

    await expect(service.setValue(IN_WORKSPACE, 'br:/main/task1', 'notes', 'x')).rejects.toThrow('The attribute notes does not exist.');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('unsets a value', async () => {
    const { service, lines } = attributes({ attribute: '' });

    await service.unsetValue(IN_WORKSPACE, 'br:/main/task1', 'status');

    expect(lines()).toEqual(['attribute unset att:status br:/main/task1']);
  });
});

describe('attributes of a repository explored without a workspace', () => {
  it('lists, creates, renames, comments, deletes, reads, sets and unsets naming the repository, outside every workspace', async () => {
    const { service, commands } = attributes({ find: '', attribute: '' });
    const onRepository = repositoryPlace('game@local');

    await service.listTypes(onRepository);
    await service.createType(onRepository, 'status', 'Where it stands');
    await service.renameType(onRepository, 'status', 'state');
    await service.deleteType(onRepository, ['state']);
    await service.valuesOf(onRepository, 'br:/main/task');
    await service.usedValues(onRepository, 'status');
    await service.setValue(onRepository, 'cs:12', 'status', 'done');
    await service.unsetValue(onRepository, 'lb:v1.0', 'status');

    expect(commands.map(({ args }) => (args[0] === 'find' ? `find ${args[1]} ${args[2]}` : args.slice(0, 4).join(' ')))).toEqual([
      "find attributetype on repository 'game@local'",
      'attribute create att:status@game@local',
      'attribute edit att:status@game@local Where it stands',
      'attribute rename att:status@game@local state',
      'attribute delete att:state@game@local',
      "find attribute where srcobj = 'br:/main/task' on repository 'game@local'",
      "find attribute where type = 'status' limit 500 on repository 'game@local'",
      'attribute set att:status@game@local cs:12@game@local',
      'attribute unset att:status@game@local lb:v1.0@game@local',
    ]);
    expect(commands.every(({ options }) => options.outsideWorkspaces)).toBe(true);
  });
});
