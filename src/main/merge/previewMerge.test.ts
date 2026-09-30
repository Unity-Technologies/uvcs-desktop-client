import { describe, expect, it } from 'vitest';
import type { MergeRequest } from '@shared/domain/merge';
import { CmError, SILENT_FAILURE_MESSAGE } from '../cm/CmError';
import { mergeOutput, statusHeader, treeListing } from '../testing/cmOutput';
import { scriptedCm } from '../testing/scriptedCm';
import { previewMerge } from './previewMerge';

const FROM_TASK: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task' };
const TO_MAIN: MergeRequest = { ...FROM_TASK, destinationBranch: '/main' };
const CONFLICT = ['FILE_CONFLICT', '/src/a.txt', '1', '3', '4', '30'];
const DESTINATION = ['CONTRIBUTOR', 'DST', '4', 'cs:4@eco@local', '/main'];
const SOURCE = ['CONTRIBUTOR', 'SRC', '3', 'cs:3@eco@local', '/main/task'];

const failure = (message: string): CmError => new CmError(message, { commandLine: 'cm merge', exitCode: 1, output: '', logEntryId: 1 });

describe('previewMerge', () => {
  it("answers that the workspace has pending changes without asking cm for a merge it would refuse", async () => {
    const { cm, lines } = scriptedCm({ 'status --short': 'CH /src/a.txt\n' });

    expect((await previewMerge(cm, '/work', FROM_TASK)).status).toBe('pendingChanges');
    expect(lines()).toEqual(['status --short --controlledchanged --changed --localdeleted']);
  });

  it("doesn't look at the workspace's changes for a merge into a server branch: they don't take part", async () => {
    const { cm, lines } = scriptedCm({ 'merge br:/main/task': mergeOutput(SOURCE, DESTINATION) });

    expect((await previewMerge(cm, '/work', TO_MAIN)).status).toBe('ready');
    expect(lines()).toEqual([`merge br:/main/task --to=br:/main --machinereadable --fieldseparator=\u001f --printcontributors`]);
  });

  it('is a quick read: no process of its own, nothing that could open a merge tool', async () => {
    const { cm, commands } = scriptedCm({ 'status --short': '', 'merge br:/main/task': mergeOutput(SOURCE, DESTINATION) });

    await previewMerge(cm, '/work', FROM_TASK);
    expect(commands.every((command) => command.route === 'query')).toBe(true);
    expect(commands.some((command) => command.args.includes('--merge'))).toBe(false);
  });

  it("names each conflicting file's repository with one listing of the destination's tree", async () => {
    const { cm, lines } = scriptedCm({
      'status --short': '',
      'merge br:/main/task': mergeOutput(SOURCE, DESTINATION, CONFLICT),
      ls: treeListing('lib@local', 'src/a.txt'),
    });

    const plan = await previewMerge(cm, '/work', FROM_TASK);
    expect(plan.fileConflicts).toEqual([expect.objectContaining({ path: '/src/a.txt', repository: 'lib@local' })]);
    expect(lines().filter((line) => line.startsWith('ls'))).toEqual(['ls /src/a.txt --tree=cs:4 --xml']);
  });

  it('lists the files in the loaded changeset when cm printed no contributors', async () => {
    const { cm, lines } = scriptedCm({
      'status --short': '',
      'status --header --xml': statusHeader('/main', { changeset: 9 }),
      'merge br:/main/task': mergeOutput(CONFLICT),
      ls: treeListing('eco@local', 'src/a.txt'),
    });

    await previewMerge(cm, '/work', FROM_TASK);
    expect(lines()).toContain('ls /src/a.txt --tree=cs:9 --xml');
  });

  it('explains a silent failure with what the plain merge says', async () => {
    const { cm } = scriptedCm({
      'status --short': '',
      'merge br:/main/task': (args) => {
        throw args.includes('--machinereadable') ? failure(SILENT_FAILURE_MESSAGE) : failure('The source branch has no changesets.');
      },
    });

    await expect(previewMerge(cm, '/work', FROM_TASK)).rejects.toThrow('The source branch has no changesets.');
  });

  it('keeps an explained failure as it is, asking nothing more', async () => {
    const { cm, lines } = scriptedCm({
      'status --short': '',
      'merge br:/main/task': () => {
        throw failure('The branch /main/task does not exist.');
      },
    });

    await expect(previewMerge(cm, '/work', FROM_TASK)).rejects.toThrow('The branch /main/task does not exist.');
    expect(lines().filter((line) => line.startsWith('merge'))).toHaveLength(1);
  });
});
