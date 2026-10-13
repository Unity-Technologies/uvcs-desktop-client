import { beforeEach, describe, expect, it } from 'vitest';
import { revealRequestIn, useFilesViewStore } from './filesViewStore';

const revealRequestFor = (workspacePath: string) => revealRequestIn(useFilesViewStore.getState(), workspacePath);

describe('reveal requests', () => {
  beforeEach(() => useFilesViewStore.setState({ revealRequest: null }));

  it('reveals the path in the workspace it was asked in', () => {
    useFilesViewStore.getState().requestReveal('/ws', 'src/a.ts', ['src/a.ts', 'src/b.ts']);

    expect(revealRequestFor('/ws')).toEqual({ workspacePath: '/ws', path: 'src/a.ts', selected: ['src/a.ts', 'src/b.ts'] });
  });

  it('reveals nothing in another workspace, whose tree would list folders it does not have', () => {
    useFilesViewStore.getState().requestReveal('/ws-a', 'Assets/Trees/Meshes/Palm.fbx');

    expect(revealRequestFor('/ws-b')).toBeNull();
  });

  it('forgets a request once it is revealed', () => {
    useFilesViewStore.getState().requestReveal('/ws', 'src/a.ts');
    useFilesViewStore.getState().revealed(revealRequestFor('/ws')!);

    expect(revealRequestFor('/ws')).toBeNull();
  });

  it('keeps a newer request made before the older one is marked revealed', () => {
    useFilesViewStore.getState().requestReveal('/ws', 'src/a.ts');
    const older = revealRequestFor('/ws')!;
    useFilesViewStore.getState().requestReveal('/ws', 'src/b.ts');
    useFilesViewStore.getState().revealed(older);

    expect(revealRequestFor('/ws')?.path).toBe('src/b.ts');
  });
});
