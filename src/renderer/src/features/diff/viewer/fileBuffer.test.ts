import { describe, expect, it } from 'vitest';
import { changedOnDisk, followsDisk, unsavedAfterEdit, unsavedAfterSave } from './fileBuffer';

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
