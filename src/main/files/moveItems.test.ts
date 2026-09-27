import { describe, expect, it, vi } from 'vitest';
import { moveArgs, moveItems } from './moveItems';

const WORKSPACE = '/ws';

function mover(existing: string[] = []) {
  return {
    cm: vi.fn(async () => undefined),
    renamePrivate: vi.fn(async () => undefined),
    exists: vi.fn(async (path: string) => existing.includes(path)),
  };
}

const context = (signal = new AbortController().signal) => ({ signal, reportProgress: vi.fn() });

describe('moveArgs', () => {
  it('moves one controlled item to its new path, both absolute', () => {
    expect(moveArgs(WORKSPACE, { from: 'src/a.ts', to: 'docs/a.ts' }, 'darwin')).toEqual(['move', '/ws/src/a.ts', '/ws/docs/a.ts']);
  });

  it('writes Windows paths on Windows', () => {
    expect(moveArgs('C:\\ws', { from: 'src/a.ts', to: 'docs/a.ts' }, 'win32')).toEqual(['move', 'C:\\ws\\src\\a.ts', 'C:\\ws\\docs\\a.ts']);
  });
});

describe('moveItems', () => {
  it('moves controlled items with one cm move each and renames private ones on disk', async () => {
    const items = mover();
    await moveItems(
      WORKSPACE,
      [
        { from: 'src/a.ts', to: 'docs/a.ts', isPrivate: false },
        { from: 'src/lib', to: 'docs/lib', isPrivate: false },
        { from: 'src/notes.txt', to: 'docs/notes.txt', isPrivate: true },
      ],
      items,
      context(),
    );
    expect(items.cm.mock.calls).toEqual([[['move', '/ws/src/a.ts', '/ws/docs/a.ts']], [['move', '/ws/src/lib', '/ws/docs/lib']]]);
    expect(items.renamePrivate).toHaveBeenCalledWith('/ws/src/notes.txt', '/ws/docs/notes.txt');
  });

  it('never moves onto an existing item, which cm would move the item into', async () => {
    const items = mover(['/ws/docs/lib']);
    const moving = moveItems(WORKSPACE, [{ from: 'src/lib', to: 'docs/lib', isPrivate: false }], items, context());
    await expect(moving).rejects.toThrow('lib already exists.');
    expect(items.cm).not.toHaveBeenCalled();
  });

  it('stops at the first failure', async () => {
    const items = mover();
    items.cm.mockRejectedValueOnce(new Error('locked'));
    const moves = [
      { from: 'a.ts', to: 'docs/a.ts', isPrivate: false },
      { from: 'b.ts', to: 'docs/b.ts', isPrivate: false },
    ];
    await expect(moveItems(WORKSPACE, moves, items, context())).rejects.toThrow('locked');
    expect(items.cm).toHaveBeenCalledTimes(1);
  });

  it('stops between items once stopped', async () => {
    const controller = new AbortController();
    const items = mover();
    items.cm.mockImplementationOnce(async () => {
      controller.abort();
      return undefined;
    });
    const moves = [
      { from: 'a.ts', to: 'docs/a.ts', isPrivate: false },
      { from: 'b.ts', to: 'docs/b.ts', isPrivate: false },
    ];
    await expect(moveItems(WORKSPACE, moves, items, context(controller.signal))).rejects.toThrow('Stopped');
    expect(items.cm).toHaveBeenCalledTimes(1);
  });

  it('counts the items moved', async () => {
    const progress = context();
    await moveItems(WORKSPACE, [{ from: 'a.ts', to: 'docs/a.ts', isPrivate: false }], mover(), progress);
    expect(progress.reportProgress.mock.calls).toEqual([
      ['Moving items', { current: 0, total: 1 }],
      ['Moving items', { current: 1, total: 1 }],
    ]);
  });
});
