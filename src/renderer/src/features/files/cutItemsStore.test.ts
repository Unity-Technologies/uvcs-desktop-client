import { beforeEach, describe, expect, it } from 'vitest';
import { useCutItemsStore, type CutItem } from './cutItemsStore';

const file = (path: string): CutItem => ({ path, name: path.slice(path.lastIndexOf('/') + 1), itemType: 'file', isPrivate: false });
const folder = (path: string): CutItem => ({ ...file(path), itemType: 'directory' });
const cutPaths = () => useCutItemsStore.getState().items.map((item) => item.path);

describe('cut items', () => {
  beforeEach(() => useCutItemsStore.getState().clear());

  it('keeps the items cut and their workspace', () => {
    useCutItemsStore.getState().cut('/ws', [file('a.ts'), folder('src')]);
    expect(cutPaths()).toEqual(['a.ts', 'src']);
    expect(useCutItemsStore.getState().workspacePath).toBe('/ws');
  });

  it('replaces the items when cutting again', () => {
    useCutItemsStore.getState().cut('/ws', [file('a.ts')]);
    useCutItemsStore.getState().cut('/ws', [file('b.ts')]);
    expect(cutPaths()).toEqual(['b.ts']);
  });

  it('keeps a cut folder but not what is inside it, which moves along', () => {
    useCutItemsStore.getState().cut('/ws', [folder('src'), file('src/a.ts'), file('src2/b.ts')]);
    expect(cutPaths()).toEqual(['src', 'src2/b.ts']);
  });

  it('never cuts the workspace root', () => {
    useCutItemsStore.getState().cut('/ws', [folder(''), file('a.ts')]);
    expect(cutPaths()).toEqual(['a.ts']);
  });

  it('forgets everything when cleared', () => {
    useCutItemsStore.getState().cut('/ws', [file('a.ts')]);
    useCutItemsStore.getState().clear();
    expect(useCutItemsStore.getState()).toMatchObject({ workspacePath: null, items: [] });
  });
});
