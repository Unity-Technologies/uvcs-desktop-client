import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findXml, formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { createAttributesService } from './attributesService';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function attributes(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createAttributesService(serviceContext(fake.cm)) };
}

describe('attribute types', () => {
  it('lists attribute types with one cm find', async () => {
    const { service, commands } = attributes({
      'find attributetype': findXml('ATTRIBUTEENTITY', { ID: 9, NAME: 'status', COMMENT: 'Task status', OWNER: 'ana', DATE: '2026-09-25', REPNAME: 'game', REPSERVER: 'local' }),
    });

    const types = await service.listTypes(WORKSPACE);

    expect(commands).toMatchObject([{ via: 'query', line: 'find attributetype --xml --nototal', options: { cwd: WORKSPACE } }]);
    expect(types).toEqual([{ id: 9, name: 'status', comment: 'Task status', owner: 'ana', date: '2026-09-25', repository: 'game@local' }]);
  });

  it('creates a type, with a second command only when it has a comment', async () => {
    const { service, lines } = attributes({ attribute: '' });

    await service.createType(WORKSPACE, 'status', '');
    await service.createType(WORKSPACE, 'reviewer', 'Who reviewed it');

    expect(lines()).toEqual(['attribute create status', 'attribute create reviewer', 'attribute edit att:reviewer Who reviewed it']);
  });

  it('renames a type, and deletes several with one command', async () => {
    const { service, lines } = attributes({ attribute: '' });

    await service.renameType(WORKSPACE, 'status', 'state');
    await service.deleteType(WORKSPACE, ['status', 'reviewer']);

    expect(lines()).toEqual(['attribute rename att:status state', 'attribute delete att:status att:reviewer']);
  });
});

describe('attribute values', () => {
  it("reads an object's values with one cm find", async () => {
    const { service, lines } = attributes({ 'find attribute': findXml('ATTRIBUTE', { NAME: 'status', VALUE: 'done' }) });

    expect(await service.valuesOf(WORKSPACE, 'br:/main/dani')).toEqual([{ name: 'status', value: 'done' }]);
    expect(lines()).toEqual(["find attribute where srcobj = 'br:/main/dani' --xml --nototal"]);
  });

  it('samples the values a type takes with one bounded query', async () => {
    const { service, commands } = attributes({ 'find attribute': formatOutput(['done'], ['in progress']) });

    expect(await service.usedValues(WORKSPACE, 'status')).toEqual(['done', 'in progress']);
    expect(commands[0]?.args.slice(0, 3)).toEqual(['find', 'attribute', "where type = 'status' limit 500"]);
  });

  it('sets a value through a file, as values may span several lines, and deletes the file afterwards', async () => {
    const { seen, answer } = readingFileOption('--valuecontents=');
    const { service, commands } = attributes({ 'attribute set': answer });

    await service.setValue(WORKSPACE, 'br:/main/task1', 'notes', '# Notes\n- one');

    expect(commands).toMatchObject([{ via: 'query', args: ['attribute', 'set', 'att:notes', 'br:/main/task1', `--valuecontents=${seen.file}`] }]);
    expect(seen.content).toBe('# Notes\n- one');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('deletes the value file when setting the value fails', async () => {
    const { seen, answer } = readingFileOption('--valuecontents=', cmFails('Error: The attribute notes does not exist.'));
    const { service } = attributes({ 'attribute set': answer });

    await expect(service.setValue(WORKSPACE, 'br:/main/task1', 'notes', 'x')).rejects.toThrow('The attribute notes does not exist.');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('unsets a value', async () => {
    const { service, lines } = attributes({ attribute: '' });

    await service.unsetValue(WORKSPACE, 'br:/main/task1', 'status');

    expect(lines()).toEqual(['attribute unset att:status br:/main/task1']);
  });
});
