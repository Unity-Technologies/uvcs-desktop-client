import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import type { ContentSource } from '@shared/domain/content';
import type { MergeRequest } from '@shared/domain/merge';
import { changedStatus, mergePreviewOutput, recordsOutput, statusHeader, treeListing } from '../cm/testing/cmOutput';
import { statusRecordsArgs } from '../cm/pendingChangesRecords';
import { TREE_ITEM_FORMAT, TREE_ITEMS } from '../cm/treeItems';
import { fakeCat } from '../cm/testing/fakeCat';
import { cmFails, fakeCmClient } from '../cm/testing/fakeCmClient';
import { contentHashOf, WorkspaceCopies } from '../files/WorkspaceCopies';
import { createContentService } from '../services/contentService';
import { serviceContext } from '../services/testing/serviceContext';
import { previewMerge } from './previewMerge';

const FROM_TASK: MergeRequest = { kind: 'merge', sourceSpec: 'br:/main/task' };
const TO_MAIN: MergeRequest = { ...FROM_TASK, destinationBranch: '/main' };
const CONFLICT = ['FILE_CONFLICT', '/src/a.txt', '1', '3', '4', '30'];
const DESTINATION = ['CONTRIBUTOR', 'DST', '4', 'cs:4@eco@local', '/main'];
const SOURCE = ['CONTRIBUTOR', 'SRC', '3', 'cs:3@eco@local', '/main/task'];

describe('previewMerge', () => {
  it("answers that the workspace has pending changes without asking cm for a merge it would refuse", async () => {
    const { cm, lines } = fakeCmClient({ status: changedStatus('src/a.txt') });

    expect((await previewMerge(cm, '/work', FROM_TASK)).status).toBe('pendingChanges');
    expect(lines()).toEqual([statusRecordsArgs('--controlledchanged', '--changed', '--localdeleted').join(' ')]);
  });

  it("doesn't look at the workspace's changes for a merge into a server branch: they don't take part", async () => {
    const { cm, lines } = fakeCmClient({ 'merge br:/main/task': mergePreviewOutput(SOURCE, DESTINATION) });

    expect((await previewMerge(cm, '/work', TO_MAIN)).status).toBe('ready');
    expect(lines()).toEqual([`merge br:/main/task --to=br:/main --machinereadable --fieldseparator=\u001f --endlineseparator=\u001e --printcontributors`]);
  });

  it('is a quick read: no process of its own, nothing that could open a merge tool', async () => {
    const { cm, commands } = fakeCmClient({ status: changedStatus(), 'merge br:/main/task': mergePreviewOutput(SOURCE, DESTINATION) });

    await previewMerge(cm, '/work', FROM_TASK);
    expect(commands.every((command) => command.via === 'query')).toBe(true);
    expect(commands.some((command) => command.args.includes('--merge'))).toBe(false);
  });

  it("names each conflicting file's repository with one listing of the destination's tree", async () => {
    const { cm, lines } = fakeCmClient({
      status: changedStatus(),
      'merge br:/main/task': mergePreviewOutput(SOURCE, DESTINATION, CONFLICT),
      ls: treeListing('lib@local', 'src/a.txt'),
    });

    const plan = await previewMerge(cm, '/work', FROM_TASK);
    expect(plan.fileConflicts).toEqual([expect.objectContaining({ path: '/src/a.txt', repository: 'lib@local' })]);
    expect(lines().filter((line) => line.startsWith('ls'))).toEqual([`ls /src/a.txt --tree=cs:4 ${TREE_ITEM_FORMAT}`]);
  });

  it('lists the files in the loaded changeset when cm printed no contributors', async () => {
    const { cm, lines } = fakeCmClient({
      status: changedStatus(),
      'status --header --xml': statusHeader('/main', { changeset: 9 }),
      'merge br:/main/task': mergePreviewOutput(CONFLICT),
      ls: treeListing('eco@local', 'src/a.txt'),
    });

    await previewMerge(cm, '/work', FROM_TASK);
    expect(lines()).toContain(`ls /src/a.txt --tree=cs:9 ${TREE_ITEM_FORMAT}`);
  });

  it('explains a silent failure with what the plain merge says', async () => {
    const { cm } = fakeCmClient({
      status: changedStatus(),
      // `--machinereadable` hides why it failed: cm prints nothing.
      'merge br:/main/task': ({ args }) => (args.includes('--machinereadable') ? cmFails('') : cmFails('The source branch has no changesets.')),
    });

    await expect(previewMerge(cm, '/work', FROM_TASK)).rejects.toThrow('The source branch has no changesets.');
  });

  it('keeps an explained failure as it is, asking nothing more', async () => {
    const { cm, lines } = fakeCmClient({
      status: changedStatus(),
      'merge br:/main/task': cmFails('The branch /main/task does not exist.'),
    });

    await expect(previewMerge(cm, '/work', FROM_TASK)).rejects.toThrow('The branch /main/task does not exist.');
    expect(lines().filter((line) => line.startsWith('merge'))).toHaveLength(1);
  });
});

describe("the merge page reading the destination's versions", () => {
  const md5 = (text: string) => contentHashOf(Buffer.from(text));
  /** `cm ls <paths> --tree=cs:4 --format=TREE_ITEM_FORMAT`: each conflicting file's revision in the destination, with its size and hash. */
  const listing = (...files: { path: string; revid: number; text: string }[]) =>
    recordsOutput(
      TREE_ITEMS,
      ...files.map(({ path, revid, text }) => ({ name: path.split('/').pop(), wkpath: `/${path}`, size: text.length, type: 'txt', changeset: 4, repspec: 'rep:eco@local', revid, itemid: 30, hash: md5(text) })),
    );
  /** The destination's version as the merge page asks for it (`conflictedFilesOf`): by its revision. */
  const destinationOf = ({ path, repository, destinationRevisionId }: { path: string; repository: string; destinationRevisionId: number }): ContentSource => ({
    kind: 'revision',
    revision: { revisionId: destinationRevisionId, repository },
    fileName: path,
  });

  it("reads each from the workspace's disk where its file is that revision unchanged, and downloads the others, with no command more than the preview's", async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'merge-wk-'));
    await mkdir(join(workspace, 'src'));
    await writeFile(join(workspace, 'src', 'a.txt'), 'destination a\n');
    await writeFile(join(workspace, 'src', 'b.txt'), 'edited since\n');
    const fake = fakeCmClient({
      status: changedStatus(),
      'merge br:/main/task': mergePreviewOutput(SOURCE, DESTINATION, CONFLICT, ['FILE_CONFLICT', '/src/b.txt', '1', '3', '4', '31']),
      ls: listing({ path: 'src/a.txt', revid: 40, text: 'destination a\n' }, { path: 'src/b.txt', revid: 41, text: 'destination b\n' }),
      cat: fakeCat((spec) => (spec === 'revid:41@eco@local' ? 'destination b\n' : undefined)),
    });
    const copies = new WorkspaceCopies({ cm: fake.cm });
    const content = createContentService(serviceContext(fake.cm, { workspaceCopies: copies }));

    const plan = await previewMerge(fake.cm, workspace, FROM_TASK, copies);
    const read = await Promise.all(plan.fileConflicts.map((conflict) => content.read(workspacePlace(workspace), destinationOf(conflict))));

    expect(read.map((one) => one.text)).toEqual(['destination a\n', 'destination b\n']);
    const afterThePreview = fake.lines().filter((line) => !line.startsWith('status') && !line.startsWith('merge'));
    expect(afterThePreview.map((line) => line.split(' ').slice(0, 2).join(' '))).toEqual(['ls /src/a.txt', 'cat revid:41@eco@local']);
  });
});
