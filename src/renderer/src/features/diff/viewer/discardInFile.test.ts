import { beforeEach, describe, expect, it, vi } from 'vitest';

const disk = vi.hoisted(() => ({ files: new Map<string, string>(), failWrites: false, writes: [] as string[] }));
const toasts = vi.hoisted(() => [] as { kind: string; title: string; action?: { label: string; run: () => void } }[]);

vi.mock('../../../api/client', () => ({
  api: {
    content: {
      read: async (_workspacePath: string, source: { path: string }) => ({ text: disk.files.get(source.path), isBinary: false, size: 0 }),
      writeWorkspaceFile: async (_workspacePath: string, path: string, text: string) => {
        if (disk.failWrites) throw new Error('EACCES: permission denied');
        disk.writes.push(text);
        disk.files.set(path, text);
      },
    },
  },
}));
vi.mock('../../../ui/toast/toastStore', () => ({
  toast: {
    success: (title: string, _detail?: string, action?: { label: string; run: () => void }) => toasts.push({ kind: 'success', title, action }),
    info: (title: string) => toasts.push({ kind: 'info', title }),
    error: (title: string) => toasts.push({ kind: 'error', title }),
  },
}));
vi.mock('./fileText', () => ({ showFileText: () => {}, refreshFileViews: async () => {} }));

import { discardInFile, undoLastDiscard, type DiscardTarget } from './discardInFile';
import { lastDiscard } from './discardHistory';

/** Every step of an undo started from a toast is done: the fakes answer at once. */
const settled = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

let file = 0;
/** A workspace file of its own for each test: the undo stack lives for the session. */
function workspaceFile(text: string, baseText: string | null = null): DiscardTarget & { matchedBase: number } {
  const path = `src/file${++file}.ts`;
  disk.files.set(path, text);
  const target = { workspacePath: '/ws', path, baseText, matchedBase: 0, onMatchesBase: () => target.matchedBase++ };
  return target;
}

beforeEach(() => {
  disk.failWrites = false;
  disk.writes.length = 0;
  toasts.length = 0;
});

describe('discarding in a file', () => {
  it('writes the new text and offers to undo it', async () => {
    const target = workspaceFile('a\nB\nC\n');
    await discardInFile(target, { before: 'a\nB\nC\n', after: 'a\nb\nC\n' }, 'Reverted 2 lines');
    expect(disk.files.get(target.path)).toBe('a\nb\nC\n');
    expect(toasts).toMatchObject([{ kind: 'success', title: `Reverted 2 lines in file${file}.ts`, action: { label: 'Undo' } }]);
  });

  it('tells when the file is back to its loaded revision', async () => {
    const target = workspaceFile('a\nB\n', 'a\nb\n');
    await discardInFile(target, { before: 'a\nB\n', after: 'a\nb\n' }, 'Reverted 1 line');
    expect(target.matchedBase).toBe(1);
  });

  it('keeps nothing to undo when the file could not be written', async () => {
    const target = workspaceFile('a\nB\n');
    disk.failWrites = true;
    await discardInFile(target, { before: 'a\nB\n', after: 'a\nb\n' }, 'Reverted 1 line');
    expect(toasts).toMatchObject([{ kind: 'error', title: `Couldn't write file${file}.ts` }]);
    expect(lastDiscard('/ws', target.path)).toBeUndefined();
  });
});

describe('undoing discards (⌘Z in the diff)', () => {
  it('takes back the newest discard of the file first, one after another', async () => {
    const target = workspaceFile('1\n2\n3\n');
    await discardInFile(target, { before: '1\n2\n3\n', after: '1\n2\n' }, 'Removed 1 line');
    await discardInFile(target, { before: '1\n2\n', after: '1\n' }, 'Removed 1 line');
    await undoLastDiscard(target);
    expect(disk.files.get(target.path)).toBe('1\n2\n');
    await undoLastDiscard(target);
    expect(disk.files.get(target.path)).toBe('1\n2\n3\n');
    await undoLastDiscard(target);
    expect(disk.files.get(target.path)).toBe('1\n2\n3\n');
  });

  it("undoes a discard from its toast, and nothing from an older discard's toast once a newer one changed the file", async () => {
    const target = workspaceFile('1\n2\n3\n');
    await discardInFile(target, { before: '1\n2\n3\n', after: '1\n2\n' }, 'Removed 1 line');
    await discardInFile(target, { before: '1\n2\n', after: '1\n' }, 'Removed 1 line');
    const [undoOlder, undoNewer] = toasts.map((toast) => toast.action!);

    undoOlder!.run();
    await settled();
    expect(disk.files.get(target.path)).toBe('1\n');

    undoNewer!.run();
    await settled();
    expect(disk.files.get(target.path)).toBe('1\n2\n');
    expect(lastDiscard('/ws', target.path)).toEqual({ before: '1\n2\n3\n', after: '1\n2\n' });
  });

  it('undoes nothing once the file changed since, so the newer changes stay', async () => {
    const target = workspaceFile('a\nB\n');
    await discardInFile(target, { before: 'a\nB\n', after: 'a\nb\n' }, 'Reverted 1 line');
    disk.files.set(target.path, 'a\nb\nsaved by an editor\n');
    disk.writes.length = 0;
    await undoLastDiscard(target);
    expect(disk.writes).toEqual([]);
    expect(toasts.at(-1)).toMatchObject({ kind: 'info', title: `file${file}.ts changed since` });
    expect(lastDiscard('/ws', target.path)).toEqual({ before: 'a\nB\n', after: 'a\nb\n' });
  });

  it('keeps the discard to undo when putting the text back failed', async () => {
    const target = workspaceFile('a\nB\n');
    await discardInFile(target, { before: 'a\nB\n', after: 'a\nb\n' }, 'Reverted 1 line');
    disk.failWrites = true;
    await undoLastDiscard(target);
    expect(lastDiscard('/ws', target.path)).toEqual({ before: 'a\nB\n', after: 'a\nb\n' });
  });
});
