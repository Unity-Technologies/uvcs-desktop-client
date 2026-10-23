import { beforeEach, describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { revealRequestIn, useFilesViewStore } from './filesViewStore';

const revealRequestFor = (workspacePath: string) => revealRequestIn(useFilesViewStore.getState(), workspacePlace(workspacePath));

describe('reveal requests', () => {
  beforeEach(() => useFilesViewStore.setState({ revealRequest: null }));

  it('reveals the path in the workspace it was asked in', () => {
    useFilesViewStore.getState().requestReveal(workspacePlace('/ws'), 'src/a.ts', ['src/a.ts', 'src/b.ts']);

    expect(revealRequestFor('/ws')).toEqual({ place: workspacePlace('/ws'), path: 'src/a.ts', selected: ['src/a.ts', 'src/b.ts'] });
  });

  it('reveals nothing in another workspace, whose tree would list folders it does not have', () => {
    useFilesViewStore.getState().requestReveal(workspacePlace('/ws-a'), 'Assets/Trees/Meshes/Palm.fbx');

    expect(revealRequestFor('/ws-b')).toBeNull();
  });

  it("reveals a path in a repository explored without a workspace there only, never in a workspace's tree", () => {
    useFilesViewStore.getState().requestReveal(repositoryPlace('game@local'), 'src/a.ts');

    expect(revealRequestIn(useFilesViewStore.getState(), repositoryPlace('game@local'))?.path).toBe('src/a.ts');
    expect(revealRequestFor('/ws')).toBeNull();
  });

  it('forgets a request once it is revealed', () => {
    useFilesViewStore.getState().requestReveal(workspacePlace('/ws'), 'src/a.ts');
    useFilesViewStore.getState().revealed(revealRequestFor('/ws')!);

    expect(revealRequestFor('/ws')).toBeNull();
  });

  it('keeps a newer request made before the older one is marked revealed', () => {
    useFilesViewStore.getState().requestReveal(workspacePlace('/ws'), 'src/a.ts');
    const older = revealRequestFor('/ws')!;
    useFilesViewStore.getState().requestReveal(workspacePlace('/ws'), 'src/b.ts');
    useFilesViewStore.getState().revealed(older);

    expect(revealRequestFor('/ws')?.path).toBe('src/b.ts');
  });
});
