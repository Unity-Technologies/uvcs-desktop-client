import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { diffRecord, shelvesCreated } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { recordingContext } from '../operations/testing/recordingContext';
import { createVerifiedShelve } from './verifiedShelve';

const workspacePath = join('/', 'wk');

const changedFile: PendingChange = { path: 'a.cs', kinds: ['changed'], itemType: 'file', size: 10, lastModified: '2026-11-10T10:00:00Z' };

/** The command line `cm` was asked to shelve with, its temp comments file left out. */
function shelveLine(fake: ReturnType<typeof fakeCmClient>): string | undefined {
  return fake.linesVia('execute')[0]?.replace(/ -commentsfile=\S+$/, '');
}

describe('createVerifiedShelve', () => {
  it('shelves a partial workspace with cm partial, which refuses the regular command', async () => {
    const fake = fakeCmClient({ 'partial shelveset create': shelvesCreated({ id: 7 }), 'diff sh:7': diffRecord('C', 'a.cs', { base: 3 }) });

    const shelve = await createVerifiedShelve(fake.cm, workspacePath, [changedFile], 'comment', 'partial', recordingContext().context, ['a.cs']);

    expect(shelve).toEqual({ id: 7, repository: 'eco@local' });
    expect(shelveLine(fake)).toBe(`partial shelveset create ${join(workspacePath, 'a.cs')} --applychanged`);
  });

  it('shelves every change of a partial workspace when no paths are given', async () => {
    const fake = fakeCmClient({ 'partial shelveset create': shelvesCreated({ id: 7 }), 'diff sh:7': diffRecord('C', 'a.cs', { base: 3 }) });

    await createVerifiedShelve(fake.cm, workspacePath, [changedFile], 'comment', 'partial', recordingContext().context);

    expect(shelveLine(fake)).toBe('partial shelveset create --applychanged');
  });

  it('shelves a standard workspace with the regular command, taking the added folders above the paths', async () => {
    const fake = fakeCmClient({ 'shelveset create': shelvesCreated({ id: 7 }), 'diff sh:7': diffRecord('C', 'a.cs', { base: 3 }) });

    await createVerifiedShelve(fake.cm, workspacePath, [changedFile], 'comment', 'standard', recordingContext().context, ['a.cs']);

    expect(shelveLine(fake)).toBe(`shelveset create ${join(workspacePath, 'a.cs')} --all --dependencies`);
  });

  it('deletes the shelve and fails when it lacks a change', async () => {
    const fake = fakeCmClient({
      'partial shelveset create': shelvesCreated({ id: 7 }),
      'diff sh:7': '',
      'shelveset delete': '',
    });

    await expect(createVerifiedShelve(fake.cm, workspacePath, [changedFile], 'comment', 'partial', recordingContext().context)).rejects.toThrow(
      "Some changes couldn't be shelved (a.cs)",
    );
    expect(fake.ran('shelveset delete sh:7@eco@local')).toBe(true);
  });
});
