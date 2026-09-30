import { describe, expect, it } from 'vitest';
import type { ContentSource } from '@shared/domain/content';
import {
  bufferAfterDiscard,
  bufferAfterEdit,
  bufferAfterRead,
  bufferAfterSave,
  changedOnDisk,
  followsDisk,
  openedBuffer,
  savedAsBase,
  unsavedAfterEdit,
  unsavedAfterSave,
  type FileBufferState,
} from './fileBuffer';
import type { DiffContents } from './useDiffContents';

const BASE: ContentSource = { kind: 'workspaceBase', path: 'a.ts' };
const FILE: ContentSource = { kind: 'workspaceFile', path: 'a.ts' };
const text = (value: string) => ({ text: value, isBinary: false, size: value.length });
/** The file against its loaded revision, as read from disk now (each read is a new object). */
const readFromDisk = (onDisk: string, base = 'a\nb\n'): DiffContents => ({ original: BASE, modified: FILE, left: text(base), right: text(onDisk) });

const shownText = (buffer: FileBufferState): string | undefined => buffer.shown.right.text;

describe("a file typed into in its diff, over the buffer's life", () => {
  it('follows the disk while nothing is typed', () => {
    const opened = openedBuffer(readFromDisk('a\nb\n'));
    const changedOutside = readFromDisk('a\nb\nfrom an agent\n');
    const after = bufferAfterRead(opened, changedOutside);
    expect(shownText(after)).toBe('a\nb\nfrom an agent\n');
    expect(after).toEqual({ shown: changedOutside, saved: 'a\nb\nfrom an agent\n', unsaved: null });
  });

  it('keeps the same buffer when the same contents are read', () => {
    const contents = readFromDisk('a\nb\n');
    const opened = openedBuffer(contents);
    expect(bufferAfterRead(opened, contents)).toBe(opened);
  });

  it('holds still with unsaved edits while the disk changes, and says so', () => {
    const typed = bufferAfterEdit(openedBuffer(readFromDisk('a\nb\n')), 'a\nB\n');
    const changedOutside = readFromDisk('a\nb\nfrom an agent\n');
    const after = bufferAfterRead(typed, changedOutside);
    expect(after).toBe(typed);
    expect(after.unsaved).toBe('a\nB\n');
    expect(changedOnDisk('a\nb\nfrom an agent\n', after)).toBe(true);
  });

  it('saves the edits, then follows the disk again once it reads them back', () => {
    const typed = bufferAfterEdit(openedBuffer(readFromDisk('a\nb\n')), 'a\nB\n');
    const saved = bufferAfterSave(typed, 'a\nB\n');
    expect(saved.unsaved).toBeNull();
    expect(changedOnDisk('a\nb\n', saved)).toBe(false);
    expect(shownText(bufferAfterRead(saved, readFromDisk('a\nB\n')))).toBe('a\nB\n');
  });

  it('follows the file read back while still saving, as the disk reached the edits', () => {
    const typed = bufferAfterEdit(openedBuffer(readFromDisk('a\nb\n')), 'a\nB\n');
    expect(shownText(bufferAfterRead(typed, readFromDisk('a\nB\n')))).toBe('a\nB\n');
  });

  it('keeps unsaved what was typed while saving', () => {
    const typed = bufferAfterEdit(openedBuffer(readFromDisk('a\nb\n')), 'a\nB\n');
    const typedOn = bufferAfterEdit(typed, 'a\nBe\n');
    const saved = bufferAfterSave(typedOn, 'a\nB\n');
    expect(saved).toMatchObject({ saved: 'a\nB\n', unsaved: 'a\nBe\n' });
    expect(changedOnDisk('a\nB\n', saved)).toBe(false);
  });

  it('puts the editor back to the saved text when the edits are discarded', () => {
    const contents = readFromDisk('a\nb\n');
    const typed = bufferAfterEdit(openedBuffer(contents), 'a\nB\n');
    expect(bufferAfterDiscard(typed, contents)).toEqual({ buffer: { ...typed, unsaved: null }, editorText: 'a\nb\n' });
  });

  it('shows the newer file on disk when the edits are discarded after it changed', () => {
    const typed = bufferAfterEdit(openedBuffer(readFromDisk('a\nb\n')), 'a\nB\n');
    const changedOutside = readFromDisk('a\nb\nfrom an agent\n');
    const { buffer, editorText } = bufferAfterDiscard(bufferAfterRead(typed, changedOutside), changedOutside);
    expect(editorText).toBeNull();
    expect(shownText(bufferAfterRead(buffer, changedOutside))).toBe('a\nb\nfrom an agent\n');
  });

  it('saves a file of lone CRs in lone CRs, and follows it once read back', () => {
    // The editor shows each lone CR as a LF (`shownText`).
    const typed = bufferAfterEdit(openedBuffer(readFromDisk('a\rb\r')), 'a\nB\nnew\n');
    expect(typed.unsaved).toBe('a\rB\rnew\r');
    expect(shownText(bufferAfterRead(bufferAfterSave(typed, 'a\rB\rnew\r'), readFromDisk('a\rB\rnew\r')))).toBe('a\rB\rnew\r');
  });

  it('tells when saving left the file as its loaded revision', () => {
    expect(savedAsBase(readFromDisk('a\nB\n'), 'a\nb\n')).toBe(true);
    expect(savedAsBase(readFromDisk('a\nB\n'), 'a\nB\n')).toBe(false);
    expect(savedAsBase({ ...readFromDisk('a\nB\n'), original: { kind: 'reviewSnapshot', path: 'a.ts' } }, 'a\nb\n')).toBe(false);
  });
});

describe('followsDisk', () => {
  it('takes the file read anew while there are no unsaved edits', () => {
    expect(followsDisk('changed outside\n', null)).toBe(true);
  });

  it('holds still with unsaved edits, so none is lost', () => {
    expect(followsDisk('changed outside\n', 'typed\n')).toBe(false);
  });

  it('takes the file once the disk has the unsaved edits: they were just saved', () => {
    expect(followsDisk('typed\n', 'typed\n')).toBe(true);
  });
});

describe('changedOnDisk', () => {
  it('tells when the disk moved on while the file had unsaved edits', () => {
    expect(changedOnDisk('changed outside\n', { saved: 'read\n', unsaved: 'typed\n' })).toBe(true);
  });

  it('says nothing while the disk has what was read or saved', () => {
    expect(changedOnDisk('read\n', { saved: 'read\n', unsaved: 'typed\n' })).toBe(false);
  });

  it('says nothing without unsaved edits: the diff follows the disk then', () => {
    expect(changedOnDisk('changed outside\n', { saved: 'read\n', unsaved: null })).toBe(false);
  });
});

describe('unsavedAfterEdit', () => {
  it('keeps what the editor holds', () => {
    expect(unsavedAfterEdit('a\nB\n', 'a\nb\n')).toBe('a\nB\n');
  });

  it('has nothing unsaved once the text is typed back to the saved one', () => {
    expect(unsavedAfterEdit('a\nb\n', 'a\nb\n')).toBeNull();
  });

  it("gives the editor's lines of a file of lone CRs back their CRs", () => {
    expect(unsavedAfterEdit('a\nB\nnew\n', 'a\rb\r')).toBe('a\rB\rnew\r');
    expect(unsavedAfterEdit('a\nb\n', 'a\rb\r')).toBeNull();
  });

  it('keeps CRLFs and a missing final line break as they are', () => {
    expect(unsavedAfterEdit('a\r\nB', 'a\r\nb')).toBe('a\r\nB');
  });
});

describe('unsavedAfterSave', () => {
  it('has nothing left unsaved once the text is written', () => {
    expect(unsavedAfterSave('typed\n', 'typed\n')).toBeNull();
  });

  it('keeps what was typed while the text was written', () => {
    expect(unsavedAfterSave('typed more\n', 'typed\n')).toBe('typed more\n');
  });
});
