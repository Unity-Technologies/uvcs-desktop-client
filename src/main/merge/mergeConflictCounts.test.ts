import { describe, expect, it } from 'vitest';
import { mergePreviewOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient } from '../cm/testing/fakeCmClient';
import { countMergeConflicts } from './mergeConflictCounts';

const DESTINATION = ['CONTRIBUTOR', 'DST', '4', 'cs:4@eco@local', '/main'];
const SOURCE = ['CONTRIBUTOR', 'SRC', '3', 'cs:3@eco@local', '/main/task'];
const fileConflict = (path: string) => ['FILE_CONFLICT', path, '1', '3', '4', '30'];
const EVIL_TWIN = ['DIR_CONFLICT', 'EVIL', 'Evil twin conflict', 'Added twice.', 'Added /src/twin.txt', 'Added /src/twin.txt', '45', 'False', 'ADD', '/src/twin.txt', 'ADD', '/src/twin.txt'];
const CHANGE = ['FILE_SRC', '/src/b.txt', '15', '18', '3657'];

describe('countMergeConflicts', () => {
  it("counts the files and the directory conflicts of a merge of one branch into another, as cm's preview lists them", async () => {
    const { cm } = fakeCmClient({ 'merge br:/main/task': mergePreviewOutput(SOURCE, DESTINATION, fileConflict('/src/a.txt'), fileConflict('/src/c.txt'), EVIL_TWIN, CHANGE) });

    expect(await countMergeConflicts(cm, '/work', '/main/task', '/main')).toEqual({ status: 'ready', files: 2, directories: 1 });
  });

  it('counts none for a merge that only applies changes', async () => {
    const { cm } = fakeCmClient({ 'merge br:/main/task': mergePreviewOutput(SOURCE, DESTINATION, CHANGE) });

    expect(await countMergeConflicts(cm, '/work', '/main/task', '/main')).toEqual({ status: 'ready', files: 0, directories: 0 });
  });

  // As `cm` prints a branch merged already, or a branch into itself: a status and the contributors, nothing to merge.
  it('says when everything is already merged', async () => {
    const { cm } = fakeCmClient({
      'merge br:/main/task': mergePreviewOutput(
        ['STATUS', 'ALREADY_CONNECTED', 'No merges detected'],
        ['CONTRIBUTOR', 'SRC', '11', 'cs:11@mr-conflicts@local', '/main/task'],
        ['CONTRIBUTOR', 'DST', '19', 'cs:19@mr-conflicts@local', '/main'],
      ),
    });

    expect(await countMergeConflicts(cm, '/work', '/main/task', '/main')).toEqual({ status: 'alreadyMerged', files: 0, directories: 0 });
  });

  // `cm` always names the contributors; a preview printing nothing at all is no answer, never "no conflicts".
  it('fails on a preview that printed nothing', async () => {
    const { cm } = fakeCmClient({ 'merge br:/main/task': '' });

    await expect(countMergeConflicts(cm, '/work', '/main/task', '/main')).rejects.toThrow();
  });

  // Over a second on a big repository: a pooled `cm shell` held that long would stall every read of the window.
  it("previews the merge into the destination on the server in a process of its own, never merging nor touching the workspace", async () => {
    const { cm, commands } = fakeCmClient({ 'merge br:/main/task': mergePreviewOutput(SOURCE, DESTINATION) });

    await countMergeConflicts(cm, '/work', '/main/task', '/main');

    expect(commands.map((command) => command.via)).toEqual(['execute']);
    expect(commands[0]!.args.slice(0, 3)).toEqual(['merge', 'br:/main/task', '--to=br:/main']);
    expect(commands[0]!.args).not.toContain('--merge');
  });

  it("fails as cm does: the card then says nothing", async () => {
    const { cm } = fakeCmClient({ 'merge br:/main/task': cmFails('The branch /main/task does not exist.') });

    await expect(countMergeConflicts(cm, '/work', '/main/task', '/main')).rejects.toThrow('does not exist');
  });
});
