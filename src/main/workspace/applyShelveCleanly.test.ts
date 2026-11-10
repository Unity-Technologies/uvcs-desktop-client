import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { change, diffRecord, formatOutput, pendingStatus } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { recordingContext } from '../operations/testing/recordingContext';
import { applyShelveCleanly } from './applyShelveCleanly';

const workspacePath = join('/', 'wk');

/** A partial workspace with Code/Hull.cs loaded, taking back shelve 12, which changed Code/Hull.cs from revision 38. */
function partialWorkspace({ loadedRevision = 38, pending = [] as string[], ls }: { loadedRevision?: number; pending?: string[]; ls?: CmAnswer } = {}) {
  return fakeCmClient({
    'status --controlledchanged --changed': pendingStatus(workspacePath, ...pending.map((path) => change('CH', path))),
    'diff sh:12': diffRecord('C', 'Code/Hull.cs', { base: 38 }),
    ls: ls ?? formatOutput(['Code', 'dir', 5, ''], ['Code\\Hull.cs', 'txt', loadedRevision, '']),
    'partial shelveset apply': '',
  });
}

describe('applyShelveCleanly in a partial workspace', () => {
  it('applies the shelve with cm partial when the workspace has loaded exactly what it started from', async () => {
    const fake = partialWorkspace();

    const outcome = await applyShelveCleanly(fake.cm, workspacePath, 12, 'partial', recordingContext().context);

    expect(outcome).toEqual({ kind: 'applied', count: 1 });
    expect(fake.linesVia('execute')).toEqual(['partial shelveset apply sh:12']);
    expect(fake.ran('ls')).toBe(true);
  });

  it('leaves the shelve shelved when a file it changed is loaded at another revision', async () => {
    const fake = partialWorkspace({ loadedRevision: 40 });

    const outcome = await applyShelveCleanly(fake.cm, workspacePath, 12, 'partial', recordingContext().context);

    expect(outcome).toEqual({ kind: 'conflicts', count: 1 });
    expect(fake.ran('partial shelveset apply')).toBe(false);
  });

  it('leaves the shelve shelved when a folder it touches is not loaded', async () => {
    const fake = partialWorkspace({ ls: cmFails('Item C:\\wk\\Code not found.', 1) });

    const outcome = await applyShelveCleanly(fake.cm, workspacePath, 12, 'partial', recordingContext().context);

    expect(outcome).toEqual({ kind: 'conflicts', count: 1 });
    expect(fake.ran('partial shelveset apply')).toBe(false);
  });

  it('applies nothing while the workspace has changes, which a changed but not checked-out file would hide from cm ls', async () => {
    const fake = partialWorkspace({ pending: ['Code/Hull.cs'] });

    const outcome = await applyShelveCleanly(fake.cm, workspacePath, 12, 'partial', recordingContext().context);

    expect(outcome).toEqual({ kind: 'pendingChanges' });
    expect(fake.ran('diff')).toBe(false);
    expect(fake.ran('partial shelveset apply')).toBe(false);
  });
});
