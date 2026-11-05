import { describe, expect, it, vi } from 'vitest';
import { fileTreeFoldingOf } from './fileTreeFolding';

const group = (key: string, collapsed = false) => ({ type: 'group', key, collapsed });
const folder = (key: string, collapsed = false) => ({ type: 'folder', key, collapsed });
const file = (key: string) => ({ type: 'file', key });

describe('fileTreeFoldingOf', () => {
  it('offers nothing for a list without groups or folders', () => {
    expect(fileTreeFoldingOf([file('a')], [file('a')], vi.fn())).toBeNull();
  });

  it('closes every group and folder, those hidden in a closed one too', () => {
    const closeOnly = vi.fn();
    const laidOut = [group('one'), folder('one/src'), file('a'), group('two')];
    fileTreeFoldingOf(laidOut, [group('one', true), group('two')], closeOnly)!.collapseAll();
    expect(closeOnly).toHaveBeenCalledWith(['one', 'one/src', 'two']);
  });

  it('opens everything by closing nothing', () => {
    const closeOnly = vi.fn();
    fileTreeFoldingOf([folder('src'), file('a')], [folder('src', true)], closeOnly)!.expandAll();
    expect(closeOnly).toHaveBeenCalledWith([]);
  });

  it('says whether something shown is open, which closing all would close', () => {
    const laidOut = [group('one'), file('a'), group('two'), file('b')];
    expect(fileTreeFoldingOf(laidOut, [group('one', true), group('two'), file('b')], vi.fn())!.anyOpen).toBe(true);
    expect(fileTreeFoldingOf(laidOut, [group('one', true), group('two', true)], vi.fn())!.anyOpen).toBe(false);
  });
});
