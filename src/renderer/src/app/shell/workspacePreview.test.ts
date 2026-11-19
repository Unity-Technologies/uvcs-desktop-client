import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import type { WorkspaceHead } from '@shared/domain/workspace';
import { shownWorkspace, workspacePreview } from './workspacePreview';

const PATH = join('work', 'space-racer');
const OTHER = join('work', 'other');
const WORKSPACES = [
  { name: 'space-racer', path: PATH, guid: 'a' },
  { name: 'other', path: OTHER, guid: 'b' },
];
const HEAD: WorkspaceHead = { repository: 'space-racer@local', repositoryName: 'space-racer', selector: { kind: 'branch', name: '/main' } };

describe('workspacePreview', () => {
  it('tells the workspace as the home screen read it: its name, repository and branch', () => {
    expect(workspacePreview(PATH, WORKSPACES, [{ [OTHER]: HEAD }, { [PATH]: HEAD }])).toEqual({
      name: 'space-racer',
      repository: 'space-racer@local',
      selector: { kind: 'branch', name: '/main' },
    });
  });

  it('knows nothing before the home screen read anything (a window opened straight into the workspace)', () => {
    expect(workspacePreview(PATH, undefined, [])).toEqual({ name: undefined, repository: undefined, selector: undefined });
  });

  it('knows the name alone while the heads are still being read', () => {
    expect(workspacePreview(PATH, WORKSPACES, [undefined])).toEqual({ name: 'space-racer', repository: undefined, selector: undefined });
  });

  it('names the repository by its own name when its server is an id people never see', () => {
    const head: WorkspaceHead = { repository: null, repositoryName: 'Game', selector: null };
    expect(workspacePreview(PATH, WORKSPACES, [{ [PATH]: head }])).toEqual({ name: 'space-racer', repository: 'Game', selector: undefined });
  });
});

describe('shownWorkspace', () => {
  it('shows the preview until the workspace’s own info is read, then the info', () => {
    const preview = { name: 'space-racer', repository: 'space-racer@local', selector: { kind: 'branch' as const, name: '/main' } };
    expect(shownWorkspace(undefined, preview)).toEqual(preview);
    const info = { name: 'space-racer', repository: 'space-racer@remote', selector: { kind: 'branch' as const, name: '/main/task' } };
    expect(shownWorkspace(info, preview)).toEqual(info);
  });
});
