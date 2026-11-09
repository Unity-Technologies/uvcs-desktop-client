import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { repositoryPlace, workspacePlace, type Place } from '@shared/domain/place';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import type { Tool, ToolSubject } from '@shared/domain/tools';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { workspaceInfoQuery } from '../../app/workspace/useWorkspace';
import { isSubmenu, SEPARATOR, type Action, type MenuEntry } from '../../lib/actions';
import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { shownToasts } from '../../testing/operationOutcome';
import { toolsSubmenu } from './toolsMenu';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

const POST: Tool = { id: 'tool:1', name: 'Post to tracker', program: '/opt/post', args: ['{object}'], targets: ['changeset', 'branch'] };
const UPLOAD: Tool = { id: 'tool:2', name: 'Upload', program: '/opt/upload', args: ['{path}'], targets: ['item'] };
const PLACE: Place = workspacePlace('/wk/game');
const CHANGESET: ToolSubject = { kind: 'changeset', id: 12 };
const BRANCH: ToolSubject = { kind: 'branch', name: '/main', repository: 'art@local' };

const labels = (entries: MenuEntry[]): string[] => entries.map((entry) => (entry === SEPARATOR ? '---' : entry.label));
const settle = () => new Promise((resolve) => setTimeout(resolve));

function entriesOf(place = PLACE, subjects: ToolSubject[] = [CHANGESET], tools = [POST, UPLOAD]): MenuEntry[] {
  const submenu = toolsSubmenu(place, subjects, tools);
  if (!submenu || !isSubmenu(submenu)) throw new Error('No Tools submenu');
  return submenu.entries;
}

const run = (entries: MenuEntry[], label: string) => (entries.find((entry) => entry !== SEPARATOR && entry.label === label) as Action).run();

afterEach(() => queryClient.clear());

describe('toolsSubmenu', () => {
  it('offers the tools that apply to what is selected, then the way to manage them', () => {
    expect(labels(entriesOf())).toEqual(['Post to tracker', '---', 'Manage tools…']);
    expect(labels(entriesOf(PLACE, [{ kind: 'item', path: '/wk/game/a.cs' }]))).toEqual(['Upload', '---', 'Manage tools…']);
  });

  it('offers only the tools that apply to every object selected', () => {
    expect(labels(entriesOf(PLACE, [CHANGESET, BRANCH]))).toEqual(['Post to tracker', '---', 'Manage tools…']);
    expect(toolsSubmenu(PLACE, [CHANGESET, { kind: 'item', path: '/wk/game/a.cs' }], [POST, UPLOAD])).toBeNull();
  });

  it('is not there when no tool applies, or the user has none', () => {
    expect(toolsSubmenu(PLACE, [{ kind: 'label', name: 'v1' }], [POST, UPLOAD])).toBeNull();
    expect(toolsSubmenu(PLACE, [CHANGESET], [])).toBeNull();
    expect(toolsSubmenu(PLACE, [], [POST])).toBeNull();
  });

  it("reads the user's tools as last read when none are given", () => {
    expect(toolsSubmenu(PLACE, [CHANGESET])).toBeNull();
    queryClient.setQueryData(queryKeys.settings, { ...DEFAULT_SETTINGS, tools: [POST] });
    expect(toolsSubmenu(PLACE, [CHANGESET])).not.toBeNull();
  });

  it("runs the tool on each object, naming the workspace's repository where the object doesn't name its own", async () => {
    queryClient.setQueryData(workspaceInfoQuery('/wk/game').queryKey, { repository: 'game@local', server: 'local' } as WorkspaceInfo);
    fakeApi.answer('tools.run', () => undefined);
    run(entriesOf(PLACE, [CHANGESET, BRANCH]), 'Post to tracker');
    await settle();
    expect(fakeApi.calls()).toEqual([
      {
        method: 'tools.run',
        args: [PLACE, 'tool:1', [{ kind: 'changeset', id: 12, repository: 'game@local' }, BRANCH]],
      },
    ]);
  });

  it("names a repository window's own repository", async () => {
    fakeApi.answer('tools.run', () => undefined);
    run(entriesOf(repositoryPlace('game@remote')), 'Post to tracker');
    await settle();
    expect(fakeApi.argsOf('tools.run')[0]?.[2]).toEqual([{ kind: 'changeset', id: 12, repository: 'game@remote' }]);
  });

  it('asks before running on more objects than it runs on without asking, and runs nothing when the user cancels', async () => {
    const many: ToolSubject[] = Array.from({ length: 21 }, (_, index) => ({ kind: 'changeset', id: index + 1 }));
    answerConfirms(false);
    run(entriesOf(PLACE, many), 'Post to tracker');
    await settle();
    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Run Post to tracker 21 times?' }]);
    expect(fakeApi.calls()).toEqual([]);
  });

  it('says which tool failed', async () => {
    fakeApi.answer('tools.run', () => {
      throw new Error("Couldn't start /opt/post: it is not there anymore");
    });
    run(entriesOf(), 'Post to tracker');
    await settle();
    expect(shownToasts()).toMatchObject([{ kind: 'error', title: "Couldn't run Post to tracker" }]);
  });
});
