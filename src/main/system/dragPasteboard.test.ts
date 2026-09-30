import { describe, expect, it, vi } from 'vitest';
import { DRAG_PASTEBOARD_SCRIPT, parseDraggedPath, readDraggedPath } from './dragPasteboard';

describe('parseDraggedPath', () => {
  it('takes the path osascript printed, without its line break', () => {
    expect(parseDraggedPath('/Users/ana/Projects/game ñ\n')).toBe('/Users/ana/Projects/game ñ');
  });

  it('is null when the pasteboard held no file', () => {
    expect(parseDraggedPath('\n')).toBeNull();
    expect(parseDraggedPath('')).toBeNull();
  });
});

describe('readDraggedPath', () => {
  it('asks osascript for the drag pasteboard as JavaScript on macOS', async () => {
    const run = vi.fn(async () => '/Applications\n');

    expect(await readDraggedPath('darwin', run)).toBe('/Applications');
    expect(run).toHaveBeenCalledWith(['-l', 'JavaScript', '-e', DRAG_PASTEBOARD_SCRIPT]);
  });

  it('reads nothing on Windows and Linux, which have no drag pasteboard to read before the drop', async () => {
    const run = vi.fn(async () => '/x');

    expect(await readDraggedPath('win32', run)).toBeNull();
    expect(await readDraggedPath('linux', run)).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('is null when osascript fails or takes too long', async () => {
    expect(await readDraggedPath('darwin', async () => Promise.reject(new Error('timed out')))).toBeNull();
  });
});
