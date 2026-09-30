import { describe, expect, it } from 'vitest';
import { droppedItems, readDroppedFolder } from './droppedFolder';

describe('readDroppedFolder', () => {
  it('takes a single folder', () => {
    expect(readDroppedFolder([{ path: '/projects/game', isDirectory: true }])).toEqual({ kind: 'folder', path: '/projects/game' });
  });

  it('takes a Windows folder as it comes', () => {
    expect(readDroppedFolder([{ path: 'C:\\projects\\juego ñ', isDirectory: true }])).toEqual({ kind: 'folder', path: 'C:\\projects\\juego ñ' });
  });

  it('refuses a file', () => {
    expect(readDroppedFolder([{ path: '/projects/game/readme.md', isDirectory: false }])).toEqual({ kind: 'notAFolder' });
  });

  it('refuses an item with no place on disk, and a drop with no files', () => {
    expect(readDroppedFolder([{ path: '', isDirectory: true }])).toEqual({ kind: 'notAFolder' });
    expect(readDroppedFolder([])).toEqual({ kind: 'notAFolder' });
  });

  it('refuses several items at once', () => {
    const folders = [
      { path: '/projects/a', isDirectory: true },
      { path: '/projects/b', isDirectory: true },
    ];
    expect(readDroppedFolder(folders)).toEqual({ kind: 'severalItems' });
  });
});

describe('droppedItems', () => {
  function dataTransferOf(items: { kind: string; name: string; isDirectory: boolean }[]): DataTransfer {
    const list = items.map(({ kind, name, isDirectory }) => ({
      kind,
      getAsFile: () => (kind === 'file' ? ({ name } as File) : null),
      webkitGetAsEntry: () => (kind === 'file' ? { isDirectory } : null),
    }));
    return { items: list } as unknown as DataTransfer;
  }

  it('reads the path and kind of each dropped file, leaving out dragged text', () => {
    const dataTransfer = dataTransferOf([
      { kind: 'file', name: 'game', isDirectory: true },
      { kind: 'string', name: '', isDirectory: false },
    ]);

    expect(droppedItems(dataTransfer, (file) => `/projects/${file.name}`)).toEqual([{ path: '/projects/game', isDirectory: true }]);
  });
});
